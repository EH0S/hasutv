import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Room from '../../models/Room.js';
import { roomConfigs } from '../config/app.config.js';
import { ensureDirectoryExists } from '../utils/file-utils.js';

// ES Module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const uploadsDir = path.join(dirname(dirname(__dirname)), 'uploads');

// Initialize rooms in database
export const initializeRooms = async () => {
    try {
        // Create default rooms if they don't exist
        const roomPromises = Object.keys(roomConfigs).map(async (roomName) => {
            const existingRoom = await Room.findOne({ name: roomName });
            if (!existingRoom) {
                const room = new Room({
                    name: roomName,
                    lastMessages: []
                });
                await room.save();
                console.log(`Created room: ${roomName}`);
            }
        });

        await Promise.all(roomPromises);
        console.log('Rooms initialized successfully');
    } catch (error) {
        console.error('Error initializing rooms:', error);
        throw error;
    }
};

// Initialize server directories and database rooms
export const initializeServer = async () => {
    try {
        // Create base uploads directory
        ensureDirectoryExists(uploadsDir);
        console.log('Created uploads directory:', uploadsDir);

        // Create room directories
        Object.keys(roomConfigs).forEach(room => {
            const roomDir = path.join(uploadsDir, room);
            ensureDirectoryExists(roomDir);
            console.log('Created room directory:', roomDir);
        });

        // Initialize rooms in database
        await initializeRooms();
        
    } catch (error) {
        console.error('Failed to initialize server:', error);
        process.exit(1);
    }
};
