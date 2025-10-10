const express = require('express');

function createLocationRoutes(db, authenticateApiKey) {
    const router = express.Router();

// Apply authentication to all location routes
router.use(authenticateApiKey);

// POST /api/location/:deviceId/update - Update device location
router.post('/:deviceId/update', async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { 
            latitude, 
            longitude, 
            accuracy, 
            altitude, 
            bearing, 
            speed,
            address,
            source = 'gps',
            battery_level,
            network_type 
        } = req.body;

        // Validate required location data
        if (!latitude || !longitude) {
            return res.status(400).json({ error: 'Latitude and longitude are required' });
        }

        // Verify device belongs to user
        const device = await db.getDeviceById(deviceId);
        if (!device || device.user_id !== req.user.id) {
            return res.status(404).json({ error: 'Device not found' });
        }

        // Save location to database
        const locationData = {
            device_id: deviceId,
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            accuracy: accuracy ? parseFloat(accuracy) : null,
            altitude: altitude ? parseFloat(altitude) : null,
            bearing: bearing ? parseFloat(bearing) : null,
            speed: speed ? parseFloat(speed) : null,
            address: address || null,
            source: source,
            battery_level: battery_level ? parseInt(battery_level) : null,
            network_type: network_type || null,
            timestamp: new Date().toISOString()
        };

        const locationResult = await db.saveLocation(locationData);

        // Update device's last seen and status
        await db.updateDeviceLastSeen(deviceId);
        if (battery_level) {
            await db.updateDeviceBatteryLevel(deviceId, battery_level);
        }

        // Log the location update
        await db.logDeviceActivity(
            deviceId,
            'location_update',
            `Location updated: ${latitude}, ${longitude} (accuracy: ${accuracy}m, source: ${source})`
        );

        // Broadcast location update via WebSocket to dashboard
        const io = req.app.get('io');
        if (io) {
            io.to(`user-${req.user.id}`).emit('location-update', {
                deviceId: deviceId,
                location: locationData,
                timestamp: locationData.timestamp
            });
        }

        res.json({
            message: 'Location updated successfully',
            locationId: locationResult.id,
            timestamp: locationData.timestamp
        });

    } catch (error) {
        console.error('Location update error:', error);
        res.status(500).json({ error: 'Failed to update location' });
    }
});

// GET /api/location/:deviceId/latest - Get latest location for device
router.get('/:deviceId/latest', async (req, res) => {
    try {
        const { deviceId } = req.params;

        // Verify device belongs to user
        const device = await db.getDeviceById(deviceId);
        if (!device || device.user_id !== req.user.id) {
            return res.status(404).json({ error: 'Device not found' });
        }

        const location = await db.getLatestLocation(deviceId);

        if (!location) {
            return res.status(404).json({ error: 'No location data found for this device' });
        }

        res.json({
            device: {
                id: device.device_id,
                name: device.device_name,
                model: device.device_model
            },
            location: location,
            age: Date.now() - new Date(location.timestamp).getTime()
        });

    } catch (error) {
        console.error('Get latest location error:', error);
        res.status(500).json({ error: 'Failed to get latest location' });
    }
});

// GET /api/location/:deviceId/history - Get location history for device
router.get('/:deviceId/history', async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { 
            startDate, 
            endDate, 
            limit = 100, 
            source = 'all',
            minAccuracy 
        } = req.query;

        // Verify device belongs to user
        const device = await db.getDeviceById(deviceId);
        if (!device || device.user_id !== req.user.id) {
            return res.status(404).json({ error: 'Device not found' });
        }

        let sql = `SELECT * FROM locations WHERE device_id = ?`;
        let params = [deviceId];

        // Add date range filter
        if (startDate) {
            sql += ` AND timestamp >= ?`;
            params.push(startDate);
        }

        if (endDate) {
            sql += ` AND timestamp <= ?`;
            params.push(endDate);
        }

        // Add source filter
        if (source !== 'all') {
            sql += ` AND source = ?`;
            params.push(source);
        }

        // Add accuracy filter
        if (minAccuracy) {
            sql += ` AND (accuracy IS NULL OR accuracy <= ?)`;
            params.push(parseFloat(minAccuracy));
        }

        sql += ` ORDER BY timestamp DESC LIMIT ?`;
        params.push(parseInt(limit));

        const locations = await db.all(sql, params);

        // Calculate distance traveled if we have multiple points
        let totalDistance = 0;
        if (locations.length > 1) {
            for (let i = 0; i < locations.length - 1; i++) {
                const distance = calculateDistance(
                    locations[i].latitude, locations[i].longitude,
                    locations[i + 1].latitude, locations[i + 1].longitude
                );
                totalDistance += distance;
            }
        }

        res.json({
            device: {
                id: device.device_id,
                name: device.device_name,
                model: device.device_model
            },
            locations: locations,
            summary: {
                totalPoints: locations.length,
                timeRange: locations.length > 0 ? {
                    start: locations[locations.length - 1].timestamp,
                    end: locations[0].timestamp
                } : null,
                totalDistanceKm: Math.round(totalDistance * 100) / 100,
                averageAccuracy: locations.length > 0 ? 
                    Math.round(locations.reduce((sum, loc) => sum + (loc.accuracy || 0), 0) / locations.length) : 0
            }
        });

    } catch (error) {
        console.error('Get location history error:', error);
        res.status(500).json({ error: 'Failed to get location history' });
    }
});

// GET /api/location/all - Get latest locations for all user devices
router.get('/all', async (req, res) => {
    try {
        const devices = await db.getUserDevices(req.user.id);
        const deviceLocations = [];

        for (const device of devices) {
            const location = await db.getLatestLocation(device.device_id);
            deviceLocations.push({
                device: {
                    id: device.device_id,
                    name: device.device_name,
                    model: device.device_model,
                    status: device.status,
                    battery_level: device.battery_level,
                    is_locked: device.is_locked
                },
                location: location,
                age: location ? Date.now() - new Date(location.timestamp).getTime() : null
            });
        }

        res.json({
            devices: deviceLocations,
            count: deviceLocations.length
        });

    } catch (error) {
        console.error('Get all locations error:', error);
        res.status(500).json({ error: 'Failed to get device locations' });
    }
});

// POST /api/location/:deviceId/geofence - Create geofence alert
router.post('/:deviceId/geofence', async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { 
            name,
            centerLatitude, 
            centerLongitude, 
            radius, 
            alertType = 'both' // 'enter', 'exit', or 'both'
        } = req.body;

        // Validate required data
        if (!name || !centerLatitude || !centerLongitude || !radius) {
            return res.status(400).json({ 
                error: 'Name, center coordinates, and radius are required' 
            });
        }

        // Verify device belongs to user
        const device = await db.getDeviceById(deviceId);
        if (!device || device.user_id !== req.user.id) {
            return res.status(404).json({ error: 'Device not found' });
        }

        // Create geofence (this would need a new table in the database)
        const geofenceResult = await db.createGeofence({
            device_id: deviceId,
            user_id: req.user.id,
            name: name,
            center_latitude: parseFloat(centerLatitude),
            center_longitude: parseFloat(centerLongitude),
            radius_meters: parseFloat(radius),
            alert_type: alertType,
            is_active: true
        });

        // Log the geofence creation
        await db.logDeviceActivity(
            deviceId,
            'geofence_created',
            `Geofence "${name}" created with ${radius}m radius`
        );

        res.status(201).json({
            message: 'Geofence created successfully',
            geofence: {
                id: geofenceResult.id,
                name: name,
                center: { latitude: centerLatitude, longitude: centerLongitude },
                radius: radius,
                alertType: alertType
            }
        });

    } catch (error) {
        console.error('Create geofence error:', error);
        res.status(500).json({ error: 'Failed to create geofence' });
    }
});

// GET /api/location/:deviceId/geofences - Get geofences for device
router.get('/:deviceId/geofences', async (req, res) => {
    try {
        const { deviceId } = req.params;

        // Verify device belongs to user
        const device = await db.getDeviceById(deviceId);
        if (!device || device.user_id !== req.user.id) {
            return res.status(404).json({ error: 'Device not found' });
        }

        const geofences = await db.getDeviceGeofences(deviceId);

        res.json({
            device: {
                id: device.device_id,
                name: device.device_name
            },
            geofences: geofences,
            count: geofences.length
        });

    } catch (error) {
        console.error('Get geofences error:', error);
        res.status(500).json({ error: 'Failed to get geofences' });
    }
});

// DELETE /api/location/geofence/:geofenceId - Delete geofence
router.delete('/geofence/:geofenceId', async (req, res) => {
    try {
        const { geofenceId } = req.params;

        // Verify geofence belongs to user
        const geofence = await db.getGeofenceById(geofenceId);
        if (!geofence || geofence.user_id !== req.user.id) {
            return res.status(404).json({ error: 'Geofence not found' });
        }

        await db.deleteGeofence(geofenceId);

        // Log the geofence deletion
        await db.logDeviceActivity(
            geofence.device_id,
            'geofence_deleted',
            `Geofence "${geofence.name}" deleted`
        );

        res.json({ message: 'Geofence deleted successfully' });

    } catch (error) {
        console.error('Delete geofence error:', error);
        res.status(500).json({ error: 'Failed to delete geofence' });
    }
});

// POST /api/location/batch-update - Batch location updates from device
router.post('/batch-update', async (req, res) => {
    try {
        const { deviceId, locations } = req.body;

        if (!deviceId || !locations || !Array.isArray(locations)) {
            return res.status(400).json({ error: 'Device ID and locations array are required' });
        }

        // Verify device belongs to user
        const device = await db.getDeviceById(deviceId);
        if (!device || device.user_id !== req.user.id) {
            return res.status(404).json({ error: 'Device not found' });
        }

        const results = [];

        for (const locationData of locations) {
            try {
                if (!locationData.latitude || !locationData.longitude) {
                    results.push({
                        timestamp: locationData.timestamp,
                        success: false,
                        error: 'Missing coordinates'
                    });
                    continue;
                }

                const fullLocationData = {
                    device_id: deviceId,
                    latitude: parseFloat(locationData.latitude),
                    longitude: parseFloat(locationData.longitude),
                    accuracy: locationData.accuracy ? parseFloat(locationData.accuracy) : null,
                    altitude: locationData.altitude ? parseFloat(locationData.altitude) : null,
                    bearing: locationData.bearing ? parseFloat(locationData.bearing) : null,
                    speed: locationData.speed ? parseFloat(locationData.speed) : null,
                    address: locationData.address || null,
                    source: locationData.source || 'gps',
                    battery_level: locationData.battery_level ? parseInt(locationData.battery_level) : null,
                    network_type: locationData.network_type || null,
                    timestamp: locationData.timestamp || new Date().toISOString()
                };

                const locationResult = await db.saveLocation(fullLocationData);

                results.push({
                    timestamp: fullLocationData.timestamp,
                    success: true,
                    locationId: locationResult.id
                });

            } catch (error) {
                results.push({
                    timestamp: locationData.timestamp,
                    success: false,
                    error: error.message
                });
            }
        }

        // Update device's last seen
        await db.updateDeviceLastSeen(deviceId);

        // Log the batch update
        await db.logDeviceActivity(
            deviceId,
            'batch_location_update',
            `Batch location update: ${results.filter(r => r.success).length}/${locations.length} successful`
        );

        res.json({
            message: 'Batch location update processed',
            results: results,
            successCount: results.filter(r => r.success).length,
            errorCount: results.filter(r => !r.success).length
        });

    } catch (error) {
        console.error('Batch location update error:', error);
        res.status(500).json({ error: 'Failed to process batch location update' });
    }
});

// Helper function to calculate distance between two points (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

    return router;
}

module.exports = createLocationRoutes;
