const express = require('express');

function createDeviceRoutes(db, authenticateApiKey) {
    const router = express.Router();

// Apply authentication to all device routes
router.use(authenticateApiKey);

// POST /api/devices/register - Register a new device
router.post('/register', async (req, res) => {
    try {
        const { deviceId, deviceName, deviceModel, androidVersion } = req.body;
        const userId = req.user.id;

        if (!deviceId || !deviceName) {
            return res.status(400).json({ 
                error: 'Device ID and name are required' 
            });
        }

        // Register or update device
        await db.registerDevice(
            userId, 
            deviceId, 
            deviceName, 
            deviceModel || 'Unknown', 
            androidVersion || 'Unknown'
        );

        // Log device registration
        await db.logDeviceActivity(
            deviceId, 
            'registration', 
            `Device registered: ${deviceName}`
        );

        res.status(201).json({
            message: 'Device registered successfully',
            deviceId: deviceId,
            status: 'active'
        });

    } catch (error) {
        console.error('Device registration error:', error);
        res.status(500).json({ error: 'Device registration failed' });
    }
});

// GET /api/devices - Get all user devices
router.get('/', async (req, res) => {
    try {
        const devices = await db.getDevicesByUserId(req.user.id);
        
        // Add latest location to each device
        const devicesWithLocation = await Promise.all(
            devices.map(async (device) => {
                const location = await db.getLatestLocation(device.device_id);
                return {
                    ...device,
                    lastLocation: location,
                    isOnline: isDeviceOnline(device.last_seen)
                };
            })
        );

        res.json({
            devices: devicesWithLocation,
            count: devices.length
        });

    } catch (error) {
        console.error('Get devices error:', error);
        res.status(500).json({ error: 'Failed to get devices' });
    }
});

// GET /api/devices/:deviceId - Get specific device details
router.get('/:deviceId', async (req, res) => {
    try {
        const { deviceId } = req.params;
        
        const device = await db.getDeviceById(deviceId);
        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }

        // Verify device belongs to user
        if (device.user_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Get additional device data
        const [location, logs] = await Promise.all([
            db.getLatestLocation(deviceId),
            db.getDeviceLogs(deviceId, 10)
        ]);

        res.json({
            ...device,
            lastLocation: location,
            recentLogs: logs,
            isOnline: isDeviceOnline(device.last_seen)
        });

    } catch (error) {
        console.error('Get device error:', error);
        res.status(500).json({ error: 'Failed to get device' });
    }
});

// POST /api/devices/:deviceId/heartbeat - Device heartbeat/ping
router.post('/:deviceId/heartbeat', async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { status = 'active', batteryLevel, networkType } = req.body;

        // Verify device belongs to user
        const device = await db.getDeviceById(deviceId);
        if (!device || device.user_id !== req.user.id) {
            return res.status(404).json({ error: 'Device not found' });
        }

        // Update device status
        await db.updateDeviceStatus(deviceId, status);

        // Log heartbeat
        await db.logDeviceActivity(
            deviceId,
            'heartbeat',
            `Status: ${status}, Battery: ${batteryLevel}%, Network: ${networkType}`
        );

        // Check for pending commands
        const pendingCommands = await db.getPendingCommands(deviceId);

        res.json({
            message: 'Heartbeat received',
            pendingCommands: pendingCommands,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Heartbeat error:', error);
        res.status(500).json({ error: 'Heartbeat failed' });
    }
});

// POST /api/devices/:deviceId/command-response - Device command response
router.post('/:deviceId/command-response', async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { commandId, status, response, error } = req.body;

        if (!commandId || !status) {
            return res.status(400).json({ 
                error: 'Command ID and status are required' 
            });
        }

        // Update command status
        await db.updateCommandStatus(
            commandId, 
            status, 
            response || error || null
        );

        // Log command execution
        await db.logDeviceActivity(
            deviceId,
            'command_response',
            `Command ${commandId} ${status}: ${response || error || 'No details'}`
        );

        // Notify dashboard via WebSocket
        const io = req.app.get('io');
        if (io) {
            const device = await db.getDeviceById(deviceId);
            if (device) {
                io.to(`dashboard-${device.user_id}`).emit('command-executed', {
                    deviceId,
                    commandId,
                    status,
                    response: response || error,
                    timestamp: new Date().toISOString()
                });
            }
        }

        res.json({
            message: 'Command response received',
            commandId: commandId,
            status: status
        });

    } catch (error) {
        console.error('Command response error:', error);
        res.status(500).json({ error: 'Failed to process command response' });
    }
});

// GET /api/devices/:deviceId/logs - Get device activity logs
router.get('/:deviceId/logs', async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { limit = 50 } = req.query;

        // Verify device belongs to user
        const device = await db.getDeviceById(deviceId);
        if (!device || device.user_id !== req.user.id) {
            return res.status(404).json({ error: 'Device not found' });
        }

        const logs = await db.getDeviceLogs(deviceId, parseInt(limit));

        res.json({
            logs: logs,
            count: logs.length
        });

    } catch (error) {
        console.error('Get logs error:', error);
        res.status(500).json({ error: 'Failed to get device logs' });
    }
});

// DELETE /api/devices/:deviceId - Remove device
router.delete('/:deviceId', async (req, res) => {
    try {
        const { deviceId } = req.params;

        // Verify device belongs to user
        const device = await db.getDeviceById(deviceId);
        if (!device || device.user_id !== req.user.id) {
            return res.status(404).json({ error: 'Device not found' });
        }

        // Delete device (cascade will handle related data)
        const sql = 'DELETE FROM devices WHERE device_id = ?';
        await db.run(sql, [deviceId]);

        res.json({
            message: 'Device removed successfully',
            deviceId: deviceId
        });

    } catch (error) {
        console.error('Delete device error:', error);
        res.status(500).json({ error: 'Failed to remove device' });
    }
});

// GET /api/devices/statistics - Get device statistics
router.get('/stats/overview', async (req, res) => {
    try {
        const stats = await db.getDeviceStatistics(req.user.id);
        
        res.json({
            statistics: stats,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Statistics error:', error);
        res.status(500).json({ error: 'Failed to get statistics' });
    }
});

// Helper function to check if device is online (last seen within 5 minutes)
function isDeviceOnline(lastSeen) {
    const now = new Date();
    const lastSeenTime = new Date(lastSeen);
    const diffMinutes = (now - lastSeenTime) / (1000 * 60);
    return diffMinutes <= 5;
}

    return router;
}

module.exports = createDeviceRoutes;
