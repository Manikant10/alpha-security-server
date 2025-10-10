const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const Database = require('../database');

const router = express.Router();
const db = new Database();

// Middleware for API key authentication
const authenticateApiKey = async (req, res, next) => {
    try {
        const apiKey = req.headers['x-api-key'];
        
        if (!apiKey) {
            return res.status(401).json({ error: 'API key required' });
        }

        const user = await db.getUserByApiKey(apiKey);
        if (!user) {
            return res.status(401).json({ error: 'Invalid API key' });
        }

        req.user = user;
        next();
    } catch (error) {
        res.status(500).json({ error: 'Authentication error' });
    }
};

// POST /api/auth/register - Register new user
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Validation
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

        // Hash password
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Generate API key
        const apiKey = uuidv4();

        // Create user
        const result = await db.createUser(username, email, passwordHash, apiKey);

        res.status(201).json({
            message: 'User registered successfully',
            userId: result.id,
            apiKey: apiKey,
            username: username
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// POST /api/auth/login - User login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ 
                error: 'Username and password are required' 
            });
        }

        // Get user
        const user = await db.getUserByUsername(username);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT token for web dashboard
        const token = jwt.sign(
            { userId: user.id, username: user.username },
            process.env.JWT_SECRET || 'alpha-security-secret',
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
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// GET /api/auth/profile - Get user profile (requires API key)
router.get('/profile', authenticateApiKey, async (req, res) => {
    try {
        const { password_hash, ...userProfile } = req.user;
        res.json(userProfile);
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
});

// POST /api/auth/refresh-api-key - Generate new API key
router.post('/refresh-api-key', authenticateApiKey, async (req, res) => {
    try {
        const newApiKey = uuidv4();
        
        const sql = 'UPDATE users SET api_key = ? WHERE id = ?';
        await db.run(sql, [newApiKey, req.user.id]);

        res.json({
            message: 'API key refreshed successfully',
            apiKey: newApiKey
        });

    } catch (error) {
        console.error('API key refresh error:', error);
        res.status(500).json({ error: 'Failed to refresh API key' });
    }
});

// Middleware export for other routes
router.authenticateApiKey = authenticateApiKey;

module.exports = router;