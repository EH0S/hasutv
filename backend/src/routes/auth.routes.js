import express from 'express';
import { check } from 'express-validator';
import { signUp, login, createGuest, refreshToken, getCurrentUser, getUserStats } from '../controllers/auth.controller.js';
import { auth } from '../middleware/auth.js';
import { authRateLimiter, userDataRateLimiter } from '../middleware/security.js';

const router = express.Router();

// Sign up route
router.post('/signup', authRateLimiter, [
    check('username').isLength({ min: 3 }).trim().escape(),
    check('password').isLength({ min: 6 })
], signUp);

// Login route
router.post('/login', authRateLimiter, [
    check('username').trim().escape(),
    check('password').exists()
], login);

// Guest login route
router.post('/guest', createGuest);

// Refresh token route
router.post('/refresh', authRateLimiter, refreshToken);

// Get current user - apply user data rate limiter
router.get('/user', userDataRateLimiter, auth, getCurrentUser);

// Get user stats
router.get('/stats', auth, getUserStats);

export default router;
