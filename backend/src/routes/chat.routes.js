import express from 'express';
import { getChatHistoryController } from '../controllers/chat.controller.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// Get chat history
router.get('/history', auth, getChatHistoryController);

export default router;
