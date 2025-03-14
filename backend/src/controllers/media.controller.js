import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { isValidRoom, roomConfigs } from '../config/app.config.js';
import { safeDeleteFile } from '../utils/file-utils.js';
import { 
    addToMediaQueue, 
    getRoomMediaQueue, 
    processUploadedFile 
} from '../services/media.service.js';

// ES Module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const uploadsDir = path.join(dirname(dirname(__dirname)), 'uploads');

// Handle file uploads
export const uploadMedia = async (req, res) => {
    let originalFile = null;
    let trimmedFile = null;

    try {
        const room = req.params.roomName;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        originalFile = file.path;

        // Check if it's a valid room
        if (!isValidRoom(room)) {
            await safeDeleteFile(originalFile);
            return res.status(400).json({ error: 'Invalid room' });
        }

        // Check if user is authenticated
        if (!req.user) {
            await safeDeleteFile(originalFile);
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Process the uploaded file
        const { mediaItem, originalFile: newOriginalFile, trimmedFile: newTrimmedFile } = 
            await processUploadedFile(file, room, req.user, roomConfigs);
        
        // Update file tracking variables
        originalFile = newOriginalFile;
        trimmedFile = newTrimmedFile;

        // Add to room's media queue
        addToMediaQueue(req.app.get('io'), room, mediaItem);

        console.log(`Media uploaded by user ${req.user.username} to room ${room}:`, mediaItem);
        res.json({ 
            message: 'File uploaded successfully', 
            mediaItem,
            queue: getRoomMediaQueue(room)
        });

    } catch (error) {
        console.error('Upload error:', error);
        // Clean up files if they exist
        const cleanup = async () => {
            if (originalFile) await safeDeleteFile(originalFile);
            if (trimmedFile) await safeDeleteFile(trimmedFile);
        };
        await cleanup();
        res.status(500).json({ error: 'Upload failed', details: error.message });
    }
};

// Get room's media queue
export const getMediaQueue = (req, res) => {
    const room = req.params.roomName;
    if (!isValidRoom(room)) {
        return res.status(400).json({ error: 'Invalid room' });
    }
    res.json(getRoomMediaQueue(room));
};

// Serve media files
export const serveMediaFile = (req, res) => {
    const { roomName, filename } = req.params;
    
    // Validate room and filename
    if (!isValidRoom(roomName)) {
        return res.status(404).json({ error: 'Room not found' });
    }

    const filePath = path.join(uploadsDir, roomName, filename);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    res.sendFile(filePath);
};
