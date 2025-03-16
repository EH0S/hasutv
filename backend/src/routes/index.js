import express from 'express';
import authRoutes from './auth.routes.js';
import chatRoutes from './chat.routes.js';
import mediaRoutes from './media.routes.js';
import { uploadsRateLimiter, auth } from '../middleware/index.js';
import { uploadMiddleware } from '../middleware/upload.js';
import { uploadMedia } from '../controllers/media.controller.js';

const router = express.Router();

// API Routes
router.use('/auth', authRoutes);
router.use('/chat', chatRoutes);
router.use('/media', mediaRoutes);

// Backward compatibility routes
router.post('/upload/:roomName', uploadsRateLimiter, auth, uploadMiddleware, uploadMedia);

// Add additional API versions here if needed in the future
// router.use('/v2/auth', v2AuthRoutes);

export default router;
