import jwt from 'jsonwebtoken';
import User from '../../models/User.js';
import { generateId } from '../utils/auth-utils.js';
import { getChatHistory, saveChatMessage } from '../services/message.service.js';
import { getMediaState, startMediaPlayback } from '../services/media.service.js';

const JWT_SECRET = process.env.JWT_SECRET;

export const configureSocketHandlers = (io) => {
    // Socket.IO middleware for authentication
    io.use(async (socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication token required'));
        }

        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            
            // Fetch the user from the database to get the username
            const user = await User.findById(decoded.userId);
            if (!user) {
                return next(new Error('User not found'));
            }
            
            // Add both userId and username to the socket.user object
            socket.user = {
                userId: decoded.userId,
                username: user.username
            };
            
            next();
        } catch (err) {
            next(new Error('Invalid token'));
        }
    });

    // Socket.IO connection handler
    io.on('connection', (socket) => {
        console.log('Client connected:', socket.id);
        let currentRoom = null;

        socket.on('room_change', async (room) => {
            try {
                if (currentRoom) {
                    socket.leave(currentRoom);
                }
                socket.join(room);
                currentRoom = room;
                socket.emit('room_changed', { room });
                
                // Send chat history
                const chatHistory = await getChatHistory(room);
                socket.emit('chat_history', { messages: chatHistory });
                
                // Start media playback if not already running
                await startMediaPlayback(io, room);
                
                // Send current media state after attempting to start playback
                const mediaState = getMediaState(room);
                mediaState.timestamp = Date.now();
                console.log('Sending initial media state after room change:', mediaState);
                socket.emit('media_state', mediaState);
            } catch (error) {
                console.error('Error handling room change:', error);
                socket.emit('error', { message: 'Failed to change room' });
            }
        });

        // Handle request for media state
        socket.on('request_media_state', () => {
            if (!currentRoom) {
                socket.emit('error', { message: 'Not in a room' });
                return;
            }
            
            const mediaState = getMediaState(currentRoom);
            mediaState.timestamp = Date.now();
            console.log('Sending media state in response to request:', mediaState);
            socket.emit('media_state', mediaState);
        });
        
        // Handle request for next media
        socket.on('request_next_media', async () => {
            if (!currentRoom) {
                socket.emit('error', { message: 'Not in a room' });
                return;
            }
            
            try {
                await startMediaPlayback(io, currentRoom);
                const mediaState = getMediaState(currentRoom);
                mediaState.timestamp = Date.now();
                console.log('Broadcasting media state after next media request:', mediaState);
                io.to(currentRoom).emit('media_state', mediaState);
            } catch (error) {
                console.error('Error handling next media request:', error);
                socket.emit('error', { message: 'Failed to get next media' });
            }
        });

        // Handle chat messages
        socket.on('chat_message', async (message) => {
            try {
                if (!currentRoom) {
                    socket.emit('error', { message: 'Not in a room' });
                    return;
                }
                
                console.log('Received chat message:', message);
                console.log('Socket user object:', socket.user);
                
                // Create a message object with the fields expected by the ChatMessage model
                const chatMessage = {
                    id: generateId(),
                    username: socket.user.username,
                    content: message.content,
                    timestamp: new Date().toISOString()
                };
                
                console.log('Prepared chat message for saving:', chatMessage);
                
                // Save the message to the database
                const savedMessage = await saveChatMessage(currentRoom, chatMessage);
                
                // Emit the saved message with the field names expected by the frontend
                io.to(currentRoom).emit('chat_message', {
                    id: savedMessage._id || chatMessage.id,
                    username: savedMessage.username,
                    text: savedMessage.text,
                    timestamp: savedMessage.createdAt || chatMessage.timestamp
                });
            } catch (error) {
                console.error('Error handling chat message:', error);
                socket.emit('error', { message: 'Failed to send message' });
            }
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
        });
    });

    return io;
};
