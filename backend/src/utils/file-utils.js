import fs from 'fs';
import path from 'path';
import { CLEANUP_CONFIG } from '../config/app.config.js';

// Track cleanup state
export let isCleanupRunning = false;
export const failedDeletes = new Map(); // Map<string, {retries: number, lastAttempt: number}>

// Clean up file safely
export const safeDeleteFile = async (filePath) => {
    try {
        await fs.promises.unlink(filePath);
        console.log(`Successfully deleted file: ${filePath}`);
        return true;
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log(`File not found for deletion: ${filePath}`);
            return true;
        } else if (error.code === 'EACCES') {
            console.error(`Permission denied when deleting file ${filePath}`);
            throw new Error(`Permission denied: ${error.message}`);
        } else {
            console.error(`Error deleting file ${filePath}:`, error);
            throw new Error(`Failed to delete file: ${error.message}`);
        }
    }
};

// Utility to handle failed deletes
export const handleFailedDelete = (filePath, error) => {
    const failed = failedDeletes.get(filePath) || { retries: 0, lastAttempt: 0 };
    failed.retries += 1;
    failed.lastAttempt = Date.now();
    failed.lastError = error.message;
    
    if (failed.retries < CLEANUP_CONFIG.MAX_RETRIES) {
        failedDeletes.set(filePath, failed);
        console.warn(`File deletion failed for ${filePath}, will retry later. Attempt ${failed.retries}/${CLEANUP_CONFIG.MAX_RETRIES}`);
    } else {
        failedDeletes.delete(filePath);
        console.error(`File deletion permanently failed for ${filePath} after ${CLEANUP_CONFIG.MAX_RETRIES} attempts:`, error);
        // Here you could implement additional alerting for persistent failures
    }
};

// Process files in batches
export const processBatch = async (files, roomDir, allActiveFiles) => {
    const batch = files.slice(0, CLEANUP_CONFIG.MAX_CONCURRENT_DELETES);
    const remaining = files.slice(CLEANUP_CONFIG.MAX_CONCURRENT_DELETES);
    
    await Promise.all(batch.map(async file => {
        const filePath = path.join(roomDir, file);
        
        // Skip active files
        if (allActiveFiles.includes(file)) {
            console.log(`Skipping active file: ${file}`);
            return;
        }

        try {
            const stats = await fs.promises.stat(filePath);
            const age = Date.now() - stats.mtimeMs;
            
            if (age > CLEANUP_CONFIG.MAX_AGE) {
                await safeDeleteFile(filePath);
                console.log(`Deleted old file: ${filePath}`);
                failedDeletes.delete(filePath); // Clear from failed deletes if it was there
            }
        } catch (error) {
            console.error(`Error processing file ${filePath}:`, error);
            handleFailedDelete(filePath, error);
        }
    }));

    if (remaining.length > 0) {
        await processBatch(remaining, roomDir, allActiveFiles);
    }
};

// Create directory if it doesn't exist
export const ensureDirectoryExists = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log('Created directory:', dirPath);
    }
};
