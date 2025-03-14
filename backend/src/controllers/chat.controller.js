import ChatMessage from '../../models/ChatMessage.js';
import { getChatHistory } from '../services/message.service.js';

// Get chat history
export const getChatHistoryController = async (req, res) => {
    try {
        const messages = await ChatMessage.find({})
            .sort({ createdAt: -1 })
            .limit(50);
        res.json(messages.reverse());
    } catch (error) {
        res.status(500).json({ error: 'Error fetching chat history' });
    }
};
