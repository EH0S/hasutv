import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { CLEANUP_CONFIG, roomConfigs } from '../config/app.config.js';
import { isCleanupRunning, failedDeletes, processBatch, handleFailedDelete, safeDeleteFile } from '../utils/file-utils.js';

// ES Module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const uploadsDir = path.join(dirname(dirname(__dirname)), 'uploads');

// Retry failed deletes
export const retryFailedDeletes = async () => {
    for (const [filePath, failed] of failedDeletes.entries()) {
        if (Date.now() - failed.lastAttempt < CLEANUP_CONFIG.RETRY_DELAY) {
            continue;
        }

        try {
            await safeDeleteFile(filePath);
            console.log(`Successfully deleted previously failed file: ${filePath}`);
            failedDeletes.delete(filePath);
        } catch (error) {
            handleFailedDelete(filePath, error);
        }
    }
};

// Main cleanup function
export const cleanupOldFiles = async () => {
    if (isCleanupRunning) {
        console.log('Cleanup already in progress, skipping this run');
        return;
    }

    try {
        isCleanupRunning = true;
        console.log('Running media cleanup...');

        // First retry any previously failed deletes
        await retryFailedDeletes();

        // Then process each room
        for (const room of Object.keys(roomConfigs)) {
            const roomDir = path.join(uploadsDir, room);
            
            try {
                const files = await fs.promises.readdir(roomDir);
                const allActiveFiles = [
                    ...roomConfigs[room].mediaQueue.map(item => item.id),
                    ...roomConfigs[room].mediaQueue.map(id => 'trimmed-' + id)
                ];
                
                await processBatch(files, roomDir, allActiveFiles);
            } catch (error) {
                console.error(`Error processing room ${room}:`, error);
            }
        }
    } finally {
        isCleanupRunning = false;
    }
};
