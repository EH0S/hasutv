import ChatMessage from '../../models/ChatMessage.js';
import Room from '../../models/Room.js';

// Get chat history for a room
export const getChatHistory = async (roomName) => {
    try {
        const room = await Room.findOne({ name: roomName });
        if (!room) {
            console.warn(`Room ${roomName} not found`);
            return [];
        }
        return room.lastMessages.map(msg => ({
            id: msg._id.toString(),
            username: msg.username,
            text: msg.text,
            timestamp: msg.createdAt
        }));
    } catch (error) {
        console.error('Error getting chat history:', error);
        return [];
    }
};

// Save a chat message to the database
export const saveChatMessage = async (roomName, message) => {
    try {
        console.log('saveChatMessage called with roomName:', roomName);
        console.log('saveChatMessage called with message:', message);
        
        const chatMessage = new ChatMessage({
            room: roomName,
            username: message.username,
            text: message.content,
            createdAt: message.timestamp
        });
        
        console.log('ChatMessage model created:', chatMessage);
        
        const savedMessage = await chatMessage.save();
        console.log('ChatMessage saved successfully:', savedMessage);
        
        // Update room's last messages
        await Room.updateOne(
            { name: roomName },
            { 
                $push: { 
                    lastMessages: { 
                        $each: [savedMessage],
                        $slice: -50  // Keep last 50 messages
                    }
                }
            }
        );
        
        return savedMessage;
    } catch (error) {
        console.error('Error saving chat message:', error);
        throw error;
    }
};
