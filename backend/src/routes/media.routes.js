import express from 'express';
import { uploadMedia, getMediaQueue, serveMediaFile } from '../controllers/media.controller.js';
import { auth } from '../middleware/auth.js';
import { uploadsRateLimiter } from '../middleware/security.js';
import { uploadMiddleware } from '../middleware/upload.js';

const router = express.Router();

// Handle file uploads with rate limiting, auth, and upload middleware
router.post('/upload/:roomName', uploadsRateLimiter, auth, uploadMiddleware, uploadMedia);

// Get room's media queue
router.get('/queue/:roomName', getMediaQueue);

// Serve media files
router.get('/:roomName/:filename', serveMediaFile);

export default router;
