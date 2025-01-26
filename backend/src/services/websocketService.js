import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { User } from '../models/user.js';
import { config } from '../config/config.js';
import { Chat } from '../models/chat.js';
import { roomService } from './roomService.js';

class WebSocketService {
    constructor(server) {
        this.wss = new WebSocketServer({ server });
        this.clients = new Map();
        this.PING_INTERVAL = 30000;
        this.MESSAGE_LIMIT = 100;
        
        this.setupWebSocketServer();
        this.startPingInterval();
    }

    setupWebSocketServer() {
        this.wss.on('connection', this.handleConnection.bind(this));
    }

    startPingInterval() {
        setInterval(() => {
            const now = Date.now();
            this.clients.forEach((client, clientId) => {
                if (now - client.lastPong > this.PING_INTERVAL * 2) {
                    console.log(`Client ${clientId} timed out`);
                    client.ws.terminate();
                    this.clients.delete(clientId);
                } else if (client.ws.readyState === WebSocket.OPEN) {
                    client.ws.ping();
                }
            });
        }, this.PING_INTERVAL);
    }

    async handleConnection(ws, req) {
        const clientId = uuidv4();
        let currentRoom = 'home';
        let user = null;

        console.log(`New client connected: ${clientId}`);

        this.clients.set(clientId, { 
            ws, 
            room: currentRoom,
            lastPong: Date.now(),
            user: null
        });

        ws.clientId = clientId;

        // Send initial room state
        this.sendRoomState(ws, currentRoom);

        // Handle pong messages
        ws.on('pong', () => {
            const client = this.clients.get(ws.clientId);
            if (client) {
                client.lastPong = Date.now();
            }
        });

        // Handle messages
        ws.on('message', async (message) => {
            try {
                const data = JSON.parse(message);
                
                switch (data.type) {
                    case 'auth':
                        user = await this.handleAuth(ws, data.token);
                        if (user) {
                            const client = this.clients.get(clientId);
                            if (client) {
                                client.user = user;
                            }
                        }
                        break;

                    case 'join':
                    case 'room_change':
                        if (data.room && roomService.isValidRoom(data.room)) {
                            await this.handleRoomChange(ws, data.room);
                            currentRoom = data.room;
                        }
                        break;

                    case 'chat':
                        if (data.message && data.message.trim()) {
                            await this.handleChat(ws, data.message, currentRoom);
                        }
                        break;

                    case 'media':
                        await this.handleMediaControl(ws, data, currentRoom);
                        break;

                    default:
                        console.warn(`Unknown message type: ${data.type}`);
                }
            } catch (error) {
                console.error('Error handling message:', error);
                this.sendError(ws, 'Invalid message format');
            }
        });

        // Handle client disconnect
        ws.on('close', () => {
            console.log(`Client disconnected: ${clientId}`);
            this.clients.delete(clientId);
            this.broadcastRoomState(currentRoom);
        });
    }

    async handleAuth(ws, token) {
        try {
            const decoded = jwt.verify(token, config.jwt.secret);
            const user = await User.findById(decoded.userId);
            
            if (user) {
                this.sendToClient(ws, {
                    type: 'auth',
                    success: true,
                    user: {
                        id: user._id,
                        username: user.username,
                        isGuest: user.isGuest
                    }
                });
                return user;
            }
        } catch (error) {
            console.error('Auth error:', error);
            this.sendError(ws, 'Authentication failed');
        }
        return null;
    }

    async handleChat(ws, message, room) {
        const client = this.clients.get(ws.clientId);
        if (!client || !client.user) {
            this.sendError(ws, 'Not authenticated');
            return;
        }

        if (message.length > this.MESSAGE_LIMIT) {
            this.sendError(ws, 'Message too long');
            return;
        }

        try {
            const chatMessage = new Chat({
                userId: client.user._id,
                username: client.user.username,
                text: message,
                room: room,
                ip: client.ip
            });

            await chatMessage.save();
            await Chat.maintainMessageLimit(room);

            // Update user's message count
            await User.findByIdAndUpdate(client.user._id, {
                $inc: { messageCount: 1 },
                lastActive: new Date()
            });

            this.broadcastToRoom(room, {
                type: 'chat',
                message: {
                    id: chatMessage._id,
                    username: chatMessage.username,
                    text: chatMessage.text,
                    createdAt: chatMessage.createdAt
                }
            });
        } catch (error) {
            console.error('Chat error:', error);
            this.sendError(ws, 'Failed to send message');
        }
    }

    async handleMediaControl(ws, data, room) {
        const client = this.clients.get(ws.clientId);
        if (!client || !client.user) {
            this.sendError(ws, 'Not authenticated');
            return;
        }

        try {
            switch (data.action) {
                case 'play':
                    await roomService.playMedia(room);
                    break;
                case 'pause':
                    await roomService.pauseMedia(room);
                    break;
                case 'skip':
                    await roomService.skipMedia(room);
                    break;
                default:
                    console.warn(`Unknown media action: ${data.action}`);
            }

            this.broadcastRoomState(room);
        } catch (error) {
            console.error('Media control error:', error);
            this.sendError(ws, 'Failed to control media');
        }
    }

    async handleRoomChange(ws, newRoom) {
        const client = this.clients.get(ws.clientId);
        if (!client) return;

        const oldRoom = client.room;
        client.room = newRoom;

        // Notify client of successful room change
        this.sendToClient(ws, {
            type: 'room_change',
            success: true,
            room: newRoom
        });

        // Send room state to client
        this.sendRoomState(ws, newRoom);

        // Broadcast state updates to both rooms
        this.broadcastRoomState(oldRoom);
        this.broadcastRoomState(newRoom);
    }

    sendRoomState(ws, room) {
        const state = roomService.getRoomState(room);
        const connectedUsers = Array.from(this.clients.values())
            .filter(client => client.room === room && client.user)
            .map(client => ({
                id: client.user._id,
                username: client.user.username,
                isGuest: client.user.isGuest
            }));

        this.sendToClient(ws, {
            type: 'roomState',
            room,
            state: {
                ...state,
                connectedUsers,
                config: roomService.getRoomConfig(room)
            }
        });
    }

    broadcastRoomState(room) {
        const state = roomService.getRoomState(room);
        const connectedUsers = Array.from(this.clients.values())
            .filter(client => client.room === room && client.user)
            .map(client => ({
                id: client.user._id,
                username: client.user.username,
                isGuest: client.user.isGuest
            }));

        this.broadcastToRoom(room, {
            type: 'roomState',
            room,
            state: {
                ...state,
                connectedUsers,
                config: roomService.getRoomConfig(room)
            }
        });
    }

    broadcastToRoom(room, message) {
        this.clients.forEach((client) => {
            if (client.room === room && client.ws.readyState === WebSocket.OPEN) {
                this.sendToClient(client.ws, message);
            }
        });
    }

    sendToClient(ws, message) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }

    sendError(ws, error) {
        this.sendToClient(ws, {
            type: 'error',
            error
        });
    }

    getConnectionStats() {
        const stats = {
            total: this.clients.size,
            rooms: {}
        };

        this.clients.forEach((client) => {
            const room = client.room || 'unknown';
            stats.rooms[room] = (stats.rooms[room] || 0) + 1;
        });

        return stats;
    }
}

export const createWebSocketService = (server) => {
    return new WebSocketService(server);
};
