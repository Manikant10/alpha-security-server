const express = require('express');

function createCommandRoutes(db, authenticateApiKey) {
    const router = express.Router();

// Apply authentication to all command routes
router.use(authenticateApiKey);

// POST /api/commands/:deviceId/lock - Lock device remotely
router.post('/:deviceId/lock', async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { message = 'Device locked remotely for security' } = req.body;

        // Verify device belongs to user
        const device = await db.getDeviceById(deviceId);
        if (!device || device.user_id !== req.user.id) {
            return res.status(404).json({ error: 'Device not found' });
        }

        // Create lock command
        const commandResult = await db.createCommand(
            deviceId,
            req.user.id,
            'LOCK_DEVICE',
            { message, timestamp: new Date().toISOString() }
        );

        // Update device lock status
        await db.updateDeviceLockStatus(deviceId, true);

        // Log the command
        await db.logDeviceActivity(
            deviceId,
            'command_sent',
            `Lock command sent - Command ID: ${commandResult.id}`
        );

        // Notify device via WebSocket if connected
        const io = req.app.get('io');
        if (io) {
            io.to(`device-${deviceId}`).emit('remote-command', {
                commandId: commandResult.id,
                type: 'LOCK_DEVICE',
                data: { message },
                timestamp: new Date().toISOString()
            });
        }

        res.status(201).json({
            message: 'Lock command sent successfully',
            commandId: commandResult.id,
            deviceId: deviceId,
            status: 'pending'
        });

    } catch (error) {
        console.error('Lock command error:', error);
        res.status(500).json({ error: 'Failed to send lock command' });
    }
});

// POST /api/commands/:deviceId/unlock - Unlock device remotely
router.post('/:deviceId/unlock', async (req, res) => {
    try {
        const { deviceId } = req.params;

        // Verify device belongs to user
        const device = await db.getDeviceById(deviceId);
        if (!device || device.user_id !== req.user.id) {
            return res.status(404).json({ error: 'Device not found' });
        }

        // Create unlock command
        const commandResult = await db.createCommand(
            deviceId,
            req.user.id,
            'UNLOCK_DEVICE',
            { timestamp: new Date().toISOString() }
        );

        // Update device lock status
        await db.updateDeviceLockStatus(deviceId, false);

        // Log the command
        await db.logDeviceActivity(
            deviceId,
            'command_sent',
            `Unlock command sent - Command ID: ${commandResult.id}`
        );

        // Notify device via WebSocket if connected
        const io = req.app.get('io');
        if (io) {
            io.to(`device-${deviceId}`).emit('remote-command', {
                commandId: commandResult.id,
                type: 'UNLOCK_DEVICE',
                data: {},
                timestamp: new Date().toISOString()
            });
        }

        res.status(201).json({
            message: 'Unlock command sent successfully',
            commandId: commandResult.id,
            deviceId: deviceId,
            status: 'pending'
        });

    } catch (error) {
        console.error('Unlock command error:', error);
        res.status(500).json({ error: 'Failed to send unlock command' });
    }
});

// POST /api/commands/:deviceId/locate - Request device location
router.post('/:deviceId/locate', async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { highAccuracy = true } = req.body;

        // Verify device belongs to user
        const device = await db.getDeviceById(deviceId);
        if (!device || device.user_id !== req.user.id) {
            return res.status(404).json({ error: 'Device not found' });
        }

        // Create locate command
        const commandResult = await db.createCommand(
            deviceId,
            req.user.id,
            'REQUEST_LOCATION',
            { highAccuracy, timestamp: new Date().toISOString() }
        );

        // Log the command
        await db.logDeviceActivity(
            deviceId,
            'command_sent',
            `Location request sent - Command ID: ${commandResult.id}`
        );

        // Notify device via WebSocket if connected
        const io = req.app.get('io');
        if (io) {
            io.to(`device-${deviceId}`).emit('remote-command', {
                commandId: commandResult.id,
                type: 'REQUEST_LOCATION',
                data: { highAccuracy },
                timestamp: new Date().toISOString()
            });
        }

        res.status(201).json({
            message: 'Location request sent successfully',
            commandId: commandResult.id,
            deviceId: deviceId,
            status: 'pending'
        });

    } catch (error) {
        console.error('Locate command error:', error);
        res.status(500).json({ error: 'Failed to send locate command' });
    }
});

// POST /api/commands/:deviceId/alarm/start - Start alarm on device
router.post('/:deviceId/alarm/start', async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { 
            duration = 30, 
            volume = 100, 
            message = 'Security Alert - Device Alarm Activated' 
        } = req.body;

        // Verify device belongs to user
        const device = await db.getDeviceById(deviceId);
        if (!device || device.user_id !== req.user.id) {
            return res.status(404).json({ error: 'Device not found' });
        }

        // Create alarm start command
        const commandResult = await db.createCommand(
            deviceId,
            req.user.id,
            'START_ALARM',
            { 
                duration, 
                volume, 
                message, 
                timestamp: new Date().toISOString() 
            }
        );

        // Update device alarm status
        await db.updateDeviceAlarmStatus(deviceId, true);

        // Log the command
        await db.logDeviceActivity(
            deviceId,
            'command_sent',
            `Start alarm command sent - Command ID: ${commandResult.id}`
        );

        // Notify device via WebSocket if connected
        const io = req.app.get('io');
        if (io) {
            io.to(`device-${deviceId}`).emit('remote-command', {
                commandId: commandResult.id,
                type: 'START_ALARM',
                data: { duration, volume, message },
                timestamp: new Date().toISOString()
            });
        }

        res.status(201).json({
            message: 'Alarm start command sent successfully',
            commandId: commandResult.id,
            deviceId: deviceId,
            status: 'pending',
            alarmDuration: duration
        });

    } catch (error) {
        console.error('Start alarm command error:', error);
        res.status(500).json({ error: 'Failed to send start alarm command' });
    }
});

// POST /api/commands/:deviceId/alarm/stop - Stop alarm on device
router.post('/:deviceId/alarm/stop', async (req, res) => {
    try {
        const { deviceId } = req.params;

        // Verify device belongs to user
        const device = await db.getDeviceById(deviceId);
        if (!device || device.user_id !== req.user.id) {
            return res.status(404).json({ error: 'Device not found' });
        }

        // Create alarm stop command
        const commandResult = await db.createCommand(
            deviceId,
            req.user.id,
            'STOP_ALARM',
            { timestamp: new Date().toISOString() }
        );

        // Update device alarm status
        await db.updateDeviceAlarmStatus(deviceId, false);

        // Log the command
        await db.logDeviceActivity(
            deviceId,
            'command_sent',
            `Stop alarm command sent - Command ID: ${commandResult.id}`
        );

        // Notify device via WebSocket if connected
        const io = req.app.get('io');
        if (io) {
            io.to(`device-${deviceId}`).emit('remote-command', {
                commandId: commandResult.id,
                type: 'STOP_ALARM',
                data: {},
                timestamp: new Date().toISOString()
            });
        }

        res.status(201).json({
            message: 'Alarm stop command sent successfully',
            commandId: commandResult.id,
            deviceId: deviceId,
            status: 'pending'
        });

    } catch (error) {
        console.error('Stop alarm command error:', error);
        res.status(500).json({ error: 'Failed to send stop alarm command' });
    }
});

// POST /api/commands/:deviceId/wipe - Factory reset device (DANGEROUS)
router.post('/:deviceId/wipe', async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { confirmWipe } = req.body;

        // Extra confirmation required for wipe
        if (confirmWipe !== 'CONFIRM_FACTORY_RESET') {
            return res.status(400).json({ 
                error: 'Wipe confirmation required. Set confirmWipe to CONFIRM_FACTORY_RESET' 
            });
        }

        // Verify device belongs to user
        const device = await db.getDeviceById(deviceId);
        if (!device || device.user_id !== req.user.id) {
            return res.status(404).json({ error: 'Device not found' });
        }

        // Create wipe command
        const commandResult = await db.createCommand(
            deviceId,
            req.user.id,
            'FACTORY_RESET',
            { 
                confirmed: true, 
                timestamp: new Date().toISOString(),
                warning: 'This will erase all data on the device'
            }
        );

        // Log the critical command
        await db.logDeviceActivity(
            deviceId,
            'critical_command',
            `FACTORY RESET command sent - Command ID: ${commandResult.id} - USER: ${req.user.username}`
        );

        // Notify device via WebSocket if connected
        const io = req.app.get('io');
        if (io) {
            io.to(`device-${deviceId}`).emit('remote-command', {
                commandId: commandResult.id,
                type: 'FACTORY_RESET',
                data: { confirmed: true },
                timestamp: new Date().toISOString()
            });
        }

        res.status(201).json({
            message: 'Factory reset command sent successfully',
            commandId: commandResult.id,
            deviceId: deviceId,
            status: 'pending',
            warning: 'This command will erase all data on the device'
        });

    } catch (error) {
        console.error('Wipe command error:', error);
        res.status(500).json({ error: 'Failed to send factory reset command' });
    }
});

// GET /api/commands/:deviceId - Get command history for device
router.get('/:deviceId', async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { limit = 50, status = 'all' } = req.query;

        // Verify device belongs to user
        const device = await db.getDeviceById(deviceId);
        if (!device || device.user_id !== req.user.id) {
            return res.status(404).json({ error: 'Device not found' });
        }

        let sql = `SELECT * FROM commands WHERE device_id = ?`;
        let params = [deviceId];

        if (status !== 'all') {
            sql += ` AND status = ?`;
            params.push(status);
        }

        sql += ` ORDER BY sent_at DESC LIMIT ?`;
        params.push(parseInt(limit));

        const commands = await db.all(sql, params);

        res.json({
            commands: commands.map(cmd => ({
                ...cmd,
                command_data: cmd.command_data ? JSON.parse(cmd.command_data) : null
            })),
            count: commands.length
        });

    } catch (error) {
        console.error('Get commands error:', error);
        res.status(500).json({ error: 'Failed to get command history' });
    }
});

// GET /api/commands/:deviceId/pending - Get pending commands for device
router.get('/:deviceId/pending', async (req, res) => {
    try {
        const { deviceId } = req.params;

        // This endpoint can be called by the device itself to check for commands
        const commands = await db.getPendingCommands(deviceId);

        res.json({
            pendingCommands: commands.map(cmd => ({
                ...cmd,
                command_data: cmd.command_data ? JSON.parse(cmd.command_data) : null
            })),
            count: commands.length
        });

    } catch (error) {
        console.error('Get pending commands error:', error);
        res.status(500).json({ error: 'Failed to get pending commands' });
    }
});

// POST /api/commands/batch - Send multiple commands to multiple devices
router.post('/batch', async (req, res) => {
    try {
        const { devices, commandType, commandData = {} } = req.body;

        if (!devices || !Array.isArray(devices) || devices.length === 0) {
            return res.status(400).json({ error: 'Devices array is required' });
        }

        if (!commandType) {
            return res.status(400).json({ error: 'Command type is required' });
        }

        const results = [];

        for (const deviceId of devices) {
            try {
                // Verify device belongs to user
                const device = await db.getDeviceById(deviceId);
                if (!device || device.user_id !== req.user.id) {
                    results.push({
                        deviceId,
                        success: false,
                        error: 'Device not found or access denied'
                    });
                    continue;
                }

                // Create command
                const commandResult = await db.createCommand(
                    deviceId,
                    req.user.id,
                    commandType,
                    { ...commandData, timestamp: new Date().toISOString() }
                );

                // Log the command
                await db.logDeviceActivity(
                    deviceId,
                    'batch_command',
                    `Batch ${commandType} command sent - Command ID: ${commandResult.id}`
                );

                // Notify device via WebSocket if connected
                const io = req.app.get('io');
                if (io) {
                    io.to(`device-${deviceId}`).emit('remote-command', {
                        commandId: commandResult.id,
                        type: commandType,
                        data: commandData,
                        timestamp: new Date().toISOString()
                    });
                }

                results.push({
                    deviceId,
                    success: true,
                    commandId: commandResult.id
                });

            } catch (error) {
                results.push({
                    deviceId,
                    success: false,
                    error: error.message
                });
            }
        }

        res.json({
            message: 'Batch command processed',
            results: results,
            successCount: results.filter(r => r.success).length,
            errorCount: results.filter(r => !r.success).length
        });

    } catch (error) {
        console.error('Batch command error:', error);
        res.status(500).json({ error: 'Failed to process batch command' });
    }
});

    return router;
}

module.exports = createCommandRoutes;
