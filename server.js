const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const http = require('http');
const path = require('path');
require('dotenv').config();

const Database = require('./database');
const authRoutes = require('./routes/auth');
const deviceRoutes = require('./routes/devices');
const locationRoutes = require('./routes/location');
const commandRoutes = require('./routes/commands');
const dashboardRoutes = require('./routes/dashboard');

class AlphaSecurityServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = new Server(this.server, {
            cors: {
                origin: process.env.FRONTEND_URL || "http://localhost:3001",
                methods: ["GET", "POST", "PUT", "DELETE"]
            }
        });
        this.port = process.env.PORT || 3000;
        this.db = new Database();
    }

    async initialize() {
        // Initialize database
        await this.db.initialize();
        
        // Setup middleware
        this.setupMiddleware();
        
        // Setup routes
        this.setupRoutes();
        
        // Setup WebSocket handlers
        this.setupWebSocket();
        
        // Setup error handling
        this.setupErrorHandling();
    }

    setupMiddleware() {
        // Security middleware
        this.app.use(helmet({
            contentSecurityPolicy: false, // Allow dashboard to load
            crossOriginEmbedderPolicy: false
        }));
        
        // CORS
        this.app.use(cors({
            origin: process.env.CORS_ORIGIN || ['http://localhost:3001', 'http://127.0.0.1:3001'],
            credentials: true
        }));

        // Rate limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // limit each IP to 100 requests per windowMs
            message: 'Too many requests from this IP, please try again later.'
        });
        this.app.use('/api/', limiter);

        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Compression
        this.app.use(compression());

        // Logging
        this.app.use(morgan('combined'));

        // Static files for dashboard
        this.app.use(express.static('public'));
    }

    setupRoutes() {
        // Dashboard HTML route
        this.app.get('/dashboard', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        });

        // Dashboard API Routes
        this.app.use('/dashboard', dashboardRoutes);

        // API Routes
        this.app.use('/api/auth', authRoutes);
        this.app.use('/api/devices', deviceRoutes);
        this.app.use('/api/location', locationRoutes);
        this.app.use('/api/commands', commandRoutes);

        // Health check
        this.app.get('/health', (req, res) => {
            res.status(200).json({
                status: 'OK',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                version: '1.0.0'
            });
        });

        // Root endpoint - redirect to dashboard
        this.app.get('/', (req, res) => {
            res.redirect('/index.html');
        });

        // API info endpoint
        this.app.get('/api', (req, res) => {
            res.json({
                name: 'Alpha Security Server',
                version: '1.0.0',
                description: 'Anti-theft server for device management',
                endpoints: {
                    health: '/health',
                    dashboard: '/',
                    api: '/api'
                }
            });
        });
    }

    setupWebSocket() {
        this.io.on('connection', (socket) => {
            console.log('Client connected:', socket.id);

            // Join device room for real-time updates
            socket.on('join-device', (deviceId) => {
                socket.join(`device-${deviceId}`);
                console.log(`Device ${deviceId} joined room`);
            });

            // Join dashboard room for real-time monitoring
            socket.on('join-dashboard', (userId) => {
                socket.join(`dashboard-${userId}`);
                console.log(`Dashboard user ${userId} joined room`);
            });

            // Join user room for dashboard updates
            socket.on('join-user-room', (userId) => {
                socket.join(`user-${userId}`);
                console.log(`User ${userId} joined room`);
            });

            // Handle location updates
            socket.on('location-update', async (data) => {
                try {
                    // Save location to database
                    await this.db.saveLocation(data);
                    
                    // Broadcast to dashboard
                    this.io.to(`dashboard-${data.userId}`).emit('location-updated', data);
                } catch (error) {
                    console.error('Location update error:', error);
                }
            });

            // Handle device status updates
            socket.on('device-status', async (data) => {
                try {
                    await this.db.updateDeviceStatus(data.deviceId, data.status);
                    
                    // Broadcast to dashboard
                    this.io.to(`dashboard-${data.userId}`).emit('device-status-updated', data);
                } catch (error) {
                    console.error('Device status update error:', error);
                }
            });

            socket.on('disconnect', () => {
                console.log('Client disconnected:', socket.id);
            });
        });

        // Store io instance for use in routes
        this.app.set('io', this.io);
    }

    setupErrorHandling() {
        // 404 handler
        this.app.use((req, res) => {
            res.status(404).json({
                error: 'Endpoint not found',
                path: req.path
            });
        });

        // Global error handler
        this.app.use((err, req, res, next) => {
            console.error(err.stack);
            res.status(500).json({
                error: 'Internal server error',
                message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
            });
        });
    }

    async start() {
        try {
            await this.initialize();
            
            this.server.listen(this.port, () => {
                console.log('🚀 Alpha Security Server started successfully!');
                console.log(`📍 Server running on port ${this.port}`);
                console.log(`🌐 Dashboard: http://localhost:${this.port}/dashboard`);
                console.log(`🔗 API: http://localhost:${this.port}/api`);
                console.log(`📡 WebSocket: ws://localhost:${this.port}`);
            });

            // Graceful shutdown
            process.on('SIGTERM', this.shutdown.bind(this));
            process.on('SIGINT', this.shutdown.bind(this));

        } catch (error) {
            console.error('Failed to start server:', error);
            process.exit(1);
        }
    }

    async shutdown() {
        console.log('🔄 Shutting down server...');
        
        // Close WebSocket connections
        this.io.close();
        
        // Close database connection
        await this.db.close();
        
        // Close HTTP server
        this.server.close(() => {
            console.log('✅ Server shutdown complete');
            process.exit(0);
        });
    }
}

// Start server
const server = new AlphaSecurityServer();
server.start();

module.exports = AlphaSecurityServer;