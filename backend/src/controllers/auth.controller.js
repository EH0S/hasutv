import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../../models/User.js';
import { getClientIp, generateGuestUsername } from '../utils/auth-utils.js';
import { JWT_CONFIG } from '../config/app.config.js';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

// Sign up a new user
export const signUp = async (req, res) => {
    try {
        console.log('Signup attempt:', { username: req.body.username });
        
        const { username, password } = req.body;
        const ip = getClientIp(req);

        // Check if username exists
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            console.log('Username already exists:', username);
            return res.status(400).json({ error: 'Username already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = new User({
            username,
            password: hashedPassword,
            ipAddresses: [{ ip, lastUsed: new Date() }]
        });

        console.log('Attempting to save user:', username);
        const savedUser = await user.save();
        console.log('User saved successfully:', savedUser._id);

        // Generate tokens
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: JWT_CONFIG.expiresIn });
        const refreshToken = jwt.sign({ userId: user._id }, JWT_REFRESH_SECRET, { expiresIn: JWT_CONFIG.refreshExpiresIn });

        res.status(201).json({
            token,
            refreshToken,
            user: { id: user._id, username: user.username }
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Error creating user', details: error.message });
    }
};

// Login an existing user
export const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        // Find user
        const user = await User.findOne({ username });
        if (!user || user.isGuest) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate tokens
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: JWT_CONFIG.expiresIn });
        const refreshToken = jwt.sign({ userId: user._id }, JWT_REFRESH_SECRET, { expiresIn: JWT_CONFIG.refreshExpiresIn });

        res.json({
            token,
            refreshToken,
            user: { id: user._id, username: user.username }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Error logging in', details: error.message });
    }
};

// Create a guest user
export const createGuest = async (req, res) => {
    try {
        const username = await generateGuestUsername();
        const ip = getClientIp(req);
        
        // Create guest user
        const user = new User({
            username,
            isGuest: true,
            ipAddresses: [{ ip, lastUsed: new Date() }]
        });

        await user.save();

        // Generate tokens
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: JWT_CONFIG.expiresIn });
        const refreshToken = jwt.sign({ userId: user._id }, JWT_REFRESH_SECRET, { expiresIn: JWT_CONFIG.refreshExpiresIn });

        res.json({
            token,
            refreshToken,
            user: { id: user._id, username: user.username }
        });
    } catch (error) {
        console.error('Guest login error:', error);
        res.status(500).json({ error: 'Error creating guest user', details: error.message });
    }
};

// Refresh authentication token
export const refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh token is required' });
        }

        const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
        const user = await User.findById(decoded.userId);
        
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        // Generate new tokens
        const newToken = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: JWT_CONFIG.expiresIn });
        const newRefreshToken = jwt.sign({ userId: user._id }, JWT_REFRESH_SECRET, { expiresIn: JWT_CONFIG.refreshExpiresIn });

        res.json({
            token: newToken,
            refreshToken: newRefreshToken,
            user: { id: user._id, username: user.username }
        });
    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(401).json({ error: 'Invalid refresh token' });
    }
};

// Get current user information
export const getCurrentUser = async (req, res) => {
    res.json({ user: { id: req.user._id, username: req.user.username } });
};

// Get user statistics
export const getUserStats = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const messageCount = await import('../../models/ChatMessage.js')
            .then(module => module.default.countDocuments({ userId: req.user._id }));
        
        res.json({
            username: user.username,
            messageCount,
            ipAddresses: user.ipAddresses,
            lastActive: user.lastActive,
            createdAt: user.createdAt
        });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching user stats' });
    }
};
