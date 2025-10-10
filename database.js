const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;

class Database {
    constructor() {
        this.dbPath = path.join(__dirname, 'data', 'alpha_security.db');
        this.db = null;
    }

    async initialize() {
        try {
            // Ensure data directory exists
            await fs.mkdir(path.dirname(this.dbPath), { recursive: true });

            // Open database connection
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('Error opening database:', err);
                    throw err;
                } else {
                    console.log('✅ Connected to SQLite database');
                }
            });

            // Create tables
            await this.createTables();

        } catch (error) {
            console.error('Database initialization failed:', error);
            throw error;
        }
    }

    async createTables() {
        const tables = [
            // Users table
            `CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                api_key TEXT UNIQUE NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // Devices table
            `CREATE TABLE IF NOT EXISTS devices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                device_id TEXT UNIQUE NOT NULL,
                device_name TEXT NOT NULL,
                device_model TEXT,
                android_version TEXT,
                last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT 'active',
                is_locked INTEGER DEFAULT 0,
                alarm_active INTEGER DEFAULT 0,
                battery_level INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`,

            // Locations table
            `CREATE TABLE IF NOT EXISTS locations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id TEXT NOT NULL,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                accuracy REAL,
                altitude REAL,
                speed REAL,
                bearing REAL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                address TEXT,
                source TEXT DEFAULT 'gps',
                battery_level INTEGER,
                network_type TEXT,
                FOREIGN KEY (device_id) REFERENCES devices (device_id) ON DELETE CASCADE
            )`,

            // Commands table (for remote commands)
            `CREATE TABLE IF NOT EXISTS commands (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id TEXT NOT NULL,
                user_id INTEGER NOT NULL,
                command_type TEXT NOT NULL,
                command_data TEXT,
                status TEXT DEFAULT 'pending',
                sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                executed_at DATETIME,
                response TEXT,
                FOREIGN KEY (device_id) REFERENCES devices (device_id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`,

            // Device logs table
            `CREATE TABLE IF NOT EXISTS device_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id TEXT NOT NULL,
                log_type TEXT NOT NULL,
                message TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (device_id) REFERENCES devices (device_id) ON DELETE CASCADE
            )`,

            // Sessions table (for web dashboard)
            `CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                expires_at DATETIME NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`,

            // Geofences table
            `CREATE TABLE IF NOT EXISTS geofences (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id TEXT NOT NULL,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                center_latitude REAL NOT NULL,
                center_longitude REAL NOT NULL,
                radius_meters REAL NOT NULL,
                alert_type TEXT DEFAULT 'both',
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (device_id) REFERENCES devices (device_id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`
        ];

        for (const tableSQL of tables) {
            await this.run(tableSQL);
        }

        // Create indexes for better performance
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_locations_device_id ON locations(device_id)',
            'CREATE INDEX IF NOT EXISTS idx_locations_timestamp ON locations(timestamp)',
            'CREATE INDEX IF NOT EXISTS idx_commands_device_id ON commands(device_id)',
            'CREATE INDEX IF NOT EXISTS idx_commands_status ON commands(status)',
            'CREATE INDEX IF NOT EXISTS idx_device_logs_device_id ON device_logs(device_id)',
            'CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_geofences_device_id ON geofences(device_id)',
            'CREATE INDEX IF NOT EXISTS idx_geofences_user_id ON geofences(user_id)'
        ];

        for (const indexSQL of indexes) {
            await this.run(indexSQL);
        }

        console.log('✅ Database tables created successfully');
    }

    // Utility method to promisify database operations
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // User operations
    async createUser(username, email, passwordHash, apiKey) {
        const sql = `INSERT INTO users (username, email, password_hash, api_key) 
                     VALUES (?, ?, ?, ?)`;
        return await this.run(sql, [username, email, passwordHash, apiKey]);
    }

    async getUserByUsername(username) {
        const sql = 'SELECT * FROM users WHERE username = ?';
        return await this.get(sql, [username]);
    }

    async getUserByApiKey(apiKey) {
        const sql = 'SELECT * FROM users WHERE api_key = ?';
        return await this.get(sql, [apiKey]);
    }

    // Device operations
    async registerDevice(userId, deviceId, deviceName, deviceModel, androidVersion) {
        const sql = `INSERT OR REPLACE INTO devices 
                     (user_id, device_id, device_name, device_model, android_version, last_seen) 
                     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;
        return await this.run(sql, [userId, deviceId, deviceName, deviceModel, androidVersion]);
    }

    async getDevicesByUserId(userId) {
        const sql = 'SELECT * FROM devices WHERE user_id = ? ORDER BY last_seen DESC';
        return await this.all(sql, [userId]);
    }

    async getDeviceById(deviceId) {
        const sql = 'SELECT * FROM devices WHERE device_id = ?';
        return await this.get(sql, [deviceId]);
    }

    async updateDeviceStatus(deviceId, status) {
        const sql = 'UPDATE devices SET status = ?, last_seen = CURRENT_TIMESTAMP WHERE device_id = ?';
        return await this.run(sql, [status, deviceId]);
    }

    async updateDeviceLockStatus(deviceId, isLocked) {
        const sql = 'UPDATE devices SET is_locked = ?, last_seen = CURRENT_TIMESTAMP WHERE device_id = ?';
        return await this.run(sql, [isLocked ? 1 : 0, deviceId]);
    }

    async updateDeviceAlarmStatus(deviceId, alarmActive) {
        const sql = 'UPDATE devices SET alarm_active = ?, last_seen = CURRENT_TIMESTAMP WHERE device_id = ?';
        return await this.run(sql, [alarmActive ? 1 : 0, deviceId]);
    }

    // Location operations
    async saveLocation(data) {
        const sql = `INSERT INTO locations 
                     (device_id, latitude, longitude, accuracy, altitude, speed, bearing, address, source, battery_level, network_type, timestamp) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        return await this.run(sql, [
            data.device_id,
            data.latitude,
            data.longitude,
            data.accuracy || null,
            data.altitude || null,
            data.speed || null,
            data.bearing || null,
            data.address || null,
            data.source || 'gps',
            data.battery_level || null,
            data.network_type || null,
            data.timestamp || new Date().toISOString()
        ]);
    }

    async getLatestLocation(deviceId) {
        const sql = `SELECT * FROM locations 
                     WHERE device_id = ? 
                     ORDER BY timestamp DESC 
                     LIMIT 1`;
        return await this.get(sql, [deviceId]);
    }

    async getLocationHistory(deviceId, limit = 100) {
        const sql = `SELECT * FROM locations 
                     WHERE device_id = ? 
                     ORDER BY timestamp DESC 
                     LIMIT ?`;
        return await this.all(sql, [deviceId, limit]);
    }

    // Command operations
    async createCommand(deviceId, userId, commandType, commandData = null) {
        const sql = `INSERT INTO commands 
                     (device_id, user_id, command_type, command_data) 
                     VALUES (?, ?, ?, ?)`;
        return await this.run(sql, [deviceId, userId, commandType, JSON.stringify(commandData)]);
    }

    async getPendingCommands(deviceId) {
        const sql = `SELECT * FROM commands 
                     WHERE device_id = ? AND status = 'pending' 
                     ORDER BY sent_at ASC`;
        return await this.all(sql, [deviceId]);
    }

    async updateCommandStatus(commandId, status, response = null) {
        const sql = `UPDATE commands 
                     SET status = ?, response = ?, executed_at = CURRENT_TIMESTAMP 
                     WHERE id = ?`;
        return await this.run(sql, [status, response, commandId]);
    }

    // Logging operations
    async logDeviceActivity(deviceId, logType, message) {
        const sql = `INSERT INTO device_logs (device_id, log_type, message) VALUES (?, ?, ?)`;
        return await this.run(sql, [deviceId, logType, message]);
    }

    async getDeviceLogs(deviceId, limit = 50) {
        const sql = `SELECT * FROM device_logs 
                     WHERE device_id = ? 
                     ORDER BY timestamp DESC 
                     LIMIT ?`;
        return await this.all(sql, [deviceId, limit]);
    }

    // Analytics and reporting
    async getDeviceStatistics(userId) {
        const deviceCount = await this.get(
            'SELECT COUNT(*) as count FROM devices WHERE user_id = ?', 
            [userId]
        );
        
        const activeDevices = await this.get(
            `SELECT COUNT(*) as count FROM devices 
             WHERE user_id = ? AND datetime(last_seen) > datetime('now', '-1 hour')`, 
            [userId]
        );

        const lockedDevices = await this.get(
            'SELECT COUNT(*) as count FROM devices WHERE user_id = ? AND is_locked = 1', 
            [userId]
        );

        return {
            total: deviceCount.count,
            active: activeDevices.count,
            locked: lockedDevices.count,
            offline: deviceCount.count - activeDevices.count
        };
    }

    // Additional device operations
    async getUserDevices(userId) {
        return await this.getDevicesByUserId(userId);
    }

    async updateDeviceLastSeen(deviceId) {
        const sql = 'UPDATE devices SET last_seen = CURRENT_TIMESTAMP WHERE device_id = ?';
        return await this.run(sql, [deviceId]);
    }

    async updateDeviceBatteryLevel(deviceId, batteryLevel) {
        const sql = 'UPDATE devices SET battery_level = ?, last_seen = CURRENT_TIMESTAMP WHERE device_id = ?';
        return await this.run(sql, [batteryLevel, deviceId]);
    }

    async removeDevice(deviceId) {
        const sql = 'DELETE FROM devices WHERE device_id = ?';
        return await this.run(sql, [deviceId]);
    }

    // Geofence operations
    async createGeofence(data) {
        const sql = `INSERT INTO geofences 
                     (device_id, user_id, name, center_latitude, center_longitude, radius_meters, alert_type, is_active) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        return await this.run(sql, [
            data.device_id,
            data.user_id,
            data.name,
            data.center_latitude,
            data.center_longitude,
            data.radius_meters,
            data.alert_type,
            data.is_active ? 1 : 0
        ]);
    }

    async getDeviceGeofences(deviceId) {
        const sql = 'SELECT * FROM geofences WHERE device_id = ? AND is_active = 1 ORDER BY created_at DESC';
        return await this.all(sql, [deviceId]);
    }

    async getGeofenceById(geofenceId) {
        const sql = 'SELECT * FROM geofences WHERE id = ?';
        return await this.get(sql, [geofenceId]);
    }

    async deleteGeofence(geofenceId) {
        const sql = 'UPDATE geofences SET is_active = 0 WHERE id = ?';
        return await this.run(sql, [geofenceId]);
    }

    // User API key operations
    async refreshUserApiKey(userId, newApiKey) {
        const sql = 'UPDATE users SET api_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
        return await this.run(sql, [newApiKey, userId]);
    }

    async getUserById(userId) {
        const sql = 'SELECT * FROM users WHERE id = ?';
        return await this.get(sql, [userId]);
    }

    async getUserByEmail(email) {
        const sql = 'SELECT * FROM users WHERE email = ?';
        return await this.get(sql, [email]);
    }

    // Enhanced command operations
    async getCommandHistory(deviceId, limit = 50) {
        const sql = `SELECT * FROM commands 
                     WHERE device_id = ? 
                     ORDER BY sent_at DESC 
                     LIMIT ?`;
        return await this.all(sql, [deviceId, limit]);
    }

    async close() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        reject(err);
                    } else {
                        console.log('✅ Database connection closed');
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }
}

module.exports = Database;