import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { roomConfigs, isValidRoom } from '../config/app.config.js';
import { safeDeleteFile } from '../utils/file-utils.js';

// ES Module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const uploadsDir = path.join(dirname(dirname(__dirname)), 'uploads');

// Get next media for room
export const getNextMedia = async (io, room) => {
    console.log('\n=== Starting getNextMedia ===');
    console.log(`Room: ${room}`);
    console.log(`Room config:`, roomConfigs[room]);

    if (!roomConfigs[room] || !roomConfigs[room].mediaQueue) {
        console.log('No room config or queue');
        io.to(room).emit('media_state', {
            media: null,
            queue: [],
            timestamp: Date.now(),
            sequenceNumber: roomConfigs[room]?.sequenceNumber || 0
        });
        return;
    }

    const queue = roomConfigs[room].mediaQueue;
    console.log(`Queue length: ${queue.length}`);
    console.log('Full queue:', queue);

    if (queue.length === 0) {
        console.log('Queue is empty');
        roomConfigs[room].currentMedia = null;
        // Increment sequence number when media state changes to empty
        roomConfigs[room].sequenceNumber += 1;
        console.log(`Incremented sequence number to ${roomConfigs[room].sequenceNumber} (empty queue)`);
        io.to(room).emit('media_state', {
            media: null,
            queue: [],
            timestamp: Date.now(),
            sequenceNumber: roomConfigs[room].sequenceNumber
        });
        return;
    }

    // Clear any existing timer
    if (roomConfigs[room].timer) {
        console.log('Clearing existing timer');
        clearTimeout(roomConfigs[room].timer);
        roomConfigs[room].timer = null;
    }

    // Get the current media
    const currentMedia = queue[0];
    console.log('Current media:', currentMedia);

    // Check if this is a new media item
    const isNewMedia = !roomConfigs[room].currentMedia || 
                      roomConfigs[room].currentMedia.id !== currentMedia.id;

    // Update room's current media
    roomConfigs[room].currentMedia = currentMedia;
    
    // Increment sequence number for new media
    if (isNewMedia) {
        roomConfigs[room].sequenceNumber += 1;
        console.log(`Incremented sequence number to ${roomConfigs[room].sequenceNumber} (new media)`);
    }

    // Verify the media file exists before proceeding
    const mediaPath = path.join(uploadsDir, room, currentMedia.id);
    console.log(`Checking media file: ${mediaPath}`);
    
    try {
        await fs.promises.access(mediaPath);
        console.log('Media file exists, proceeding with playback');

        // Calculate the remaining queue for broadcast
        const remainingQueue = queue.slice(1);
        console.log('Remaining queue:', remainingQueue);

        // Broadcast current media state with sequence number
        io.to(room).emit('media_state', {
            media: currentMedia,
            queue: remainingQueue,
            timestamp: Date.now(),
            sequenceNumber: roomConfigs[room].sequenceNumber
        });

        // Set timer based on media duration
        const duration = currentMedia.duration || roomConfigs[room].maxDuration;
        const switchInterval = Math.min(
            duration * 1000,           // Convert duration to milliseconds
            roomConfigs[room].interval // Room's max interval as fallback
        );
        console.log(`Setting timer for ${duration} seconds (${switchInterval}ms)`);
        
        roomConfigs[room].timer = setTimeout(() => {
            console.log('\n=== Timer expired ===');
            console.log('Queue before check:', queue);

            // Only remove media if there's more than one item in the queue
            if (queue.length > 1) {
                const played = queue.shift();
                console.log('Removed played media:', played.id);
                cleanupMediaFiles(room, played);
            } else {
                console.log('Only one media in queue - keeping it playing:', queue[0].id);
            }
            
            // Start playing the next media (or replay the current one if it's the only one)
            getNextMedia(io, room);
        }, switchInterval);

    } catch (error) {
        console.error(`Media file not found: ${mediaPath}`);
        // Remove missing media and try next
        queue.shift();
        getNextMedia(io, room);
    }
    
    console.log('=== Finished getNextMedia ===\n');
};

// Clean up media files
export const cleanupMediaFiles = async (room, mediaItem) => {
    if (!mediaItem || !mediaItem.id) {
        console.log('Invalid media item for cleanup');
        return;
    }

    console.log(`\n=== Cleaning up media files ===`);
    console.log(`Room: ${room}, Media: ${mediaItem.id}`);

    try {
        // For trimmed videos, the ID already includes 'trimmed-' prefix
        const isAlreadyTrimmed = mediaItem.id.startsWith('trimmed-');
        
        // Original file path (might be the trimmed file)
        const filePath = path.join(uploadsDir, room, mediaItem.id);
        if (fs.existsSync(filePath)) {
            console.log(`Deleting file: ${filePath}`);
            fs.unlinkSync(filePath);
            console.log(`Successfully deleted: ${filePath}`);
        }

        // Only try to delete trimmed version if the original wasn't already trimmed
        if (!isAlreadyTrimmed) {
            const trimmedPath = path.join(uploadsDir, room, 'trimmed-' + mediaItem.id);
            if (fs.existsSync(trimmedPath)) {
                console.log(`Deleting trimmed file: ${trimmedPath}`);
                fs.unlinkSync(trimmedPath);
                console.log(`Successfully deleted trimmed file: ${trimmedPath}`);
            }
        }
    } catch (err) {
        console.error(`Error during file cleanup for ${mediaItem.id}:`, err);
    }
    
    console.log('=== Finished cleanup ===\n');
};

// Start media playback for a room
export const startMediaPlayback = async (io, room) => {
    if (!roomConfigs[room]) {
        console.warn(`Room ${room} not found in startMediaPlayback`);
        return;
    }

    // Avoid multiple concurrent queue processing
    if (roomConfigs[room].processingQueue) {
        console.log(`Already processing queue for room ${room}`);
        return;
    }

    try {
        console.log(`Starting media playback for room ${room}`);
        roomConfigs[room].processingQueue = true;

        // Check if a timer is already running
        if (roomConfigs[room].timer) {
            console.log(`Timer already running for room ${room}, clearing it`);
            clearTimeout(roomConfigs[room].timer);
            roomConfigs[room].timer = null;
        }

        // Get next media item
        let nextMedia = null;
        if (roomConfigs[room].currentMedia === null && roomConfigs[room].mediaQueue.length > 0) {
            // Get the first item if nothing is currently playing
            nextMedia = roomConfigs[room].mediaQueue[0];
            console.log('Got first media from queue:', nextMedia);
        } else if (roomConfigs[room].mediaQueue.length > 0) {
            // Get next item
            nextMedia = roomConfigs[room].mediaQueue[0];
            console.log('Got next media from queue:', nextMedia);
        } else if (roomConfigs[room].currentMedia !== null) {
            // If queue is empty but we have currentMedia, keep playing it
            console.log('Queue empty, continuing with current media:', roomConfigs[room].currentMedia);
            nextMedia = roomConfigs[room].currentMedia;
        }

        // If no media available, reset state and return
        if (!nextMedia) {
            roomConfigs[room].currentMedia = null;
            roomConfigs[room].sequenceNumber += 1;
            console.log(`No media available for room ${room}, incrementing sequence number to ${roomConfigs[room].sequenceNumber}`);
            // Use 'broadcast' as clientId for broadcasts to indicate this is a server broadcast
            io.to(room).emit('media_state', getMediaState(room, 'broadcast'));
            roomConfigs[room].processingQueue = false;
            return;
        }

        // Update current media
        const previousMedia = roomConfigs[room].currentMedia;
        roomConfigs[room].currentMedia = nextMedia;
        
        // Increment sequence number if media has changed
        if (previousMedia !== nextMedia) {
            roomConfigs[room].sequenceNumber += 1;
            console.log(`Media changed for room ${room}, incrementing sequence number to ${roomConfigs[room].sequenceNumber}`);
        }

        // Set timer based on media duration
        const duration = nextMedia.duration || roomConfigs[room].maxDuration;
        const switchInterval = Math.min(
            duration * 1000,           // Convert duration to milliseconds
            roomConfigs[room].interval // Room's max interval as fallback
        );
        console.log(`Setting timer for ${duration} seconds (${switchInterval}ms) in room ${room}`);
        
        // Start the timer to switch to next media after the interval
        roomConfigs[room].timer = setTimeout(() => {
            console.log(`\n=== Timer expired for room ${room} ===`);
            
            // Only remove media if there's more than one item in the queue
            if (roomConfigs[room].mediaQueue.length > 1) {
                const played = roomConfigs[room].mediaQueue.shift();
                console.log('Removed played media:', played.id);
                cleanupMediaFiles(room, played);
            } else {
                console.log('Only one media in queue - keeping it playing:', roomConfigs[room].mediaQueue[0].id);
            }
            
            // Start the next playback cycle
            startMediaPlayback(io, room);
        }, switchInterval);

        // Broadcast update to all clients in the room
        // Use 'broadcast' as clientId for broadcasts to indicate this is a server broadcast
        io.to(room).emit('media_state', getMediaState(room, 'broadcast'));
    } catch (error) {
        console.error('Error starting media playback:', error);
    } finally {
        roomConfigs[room].processingQueue = false;
    }
};

// Add media to queue
export const addToMediaQueue = (io, room, mediaItem) => {
    console.log('\n=== Adding media to queue ===');
    console.log(`Room: ${room}`);
    console.log('Media item:', mediaItem);

    if (!roomConfigs[room]) {
        console.error('Invalid room');
        return;
    }

    // Add to queue
    roomConfigs[room].mediaQueue.push(mediaItem);
    const queueLength = roomConfigs[room].mediaQueue.length;
    console.log(`Queue length after add: ${queueLength}`);
    console.log('Current queue:', roomConfigs[room].mediaQueue);

    // Broadcast updated queue to all clients in the room
    io.to(room).emit('queue_update', {
        queue: roomConfigs[room].mediaQueue
    });

    // If this is the only item, start playback
    if (queueLength === 1) {
        console.log('First item in queue, starting playback');
        startMediaPlayback(io, room);
    }
    
    console.log('=== Finished adding media ===\n');
};

// Get room's media queue
export const getRoomMediaQueue = (room) => {
    return roomConfigs[room]?.mediaQueue || [];
};

// Get the current media state for a room
export const getMediaState = (room, clientId = null) => {
    if (!roomConfigs[room]) {
        return { media: null, queue: [], timestamp: Date.now(), sequenceNumber: 0 };
    }
    
    // Add timestamp and sequence number to media state to help with duplicate detection
    return {
        media: roomConfigs[room].currentMedia,
        queue: roomConfigs[room].mediaQueue,
        timestamp: Date.now(),
        sequenceNumber: roomConfigs[room].sequenceNumber,
        clientId: clientId // Include client ID if provided
    };
};

// Process uploaded file
export const processUploadedFile = async (file, room, user, roomConfigs) => {
    let originalFile = file.path;
    let trimmedFile = null;
    let finalPath = file.path;
    let duration = 0;

    try {
        // Check if it's a video file
        if (file.mimetype.startsWith('video/')) {
            const { getVideoMetadata, trimVideo } = await import('../utils/media-utils.js');
            
            const metadata = await getVideoMetadata(file.path);
            duration = metadata.format.duration;
            console.log(`Original video duration: ${duration}s`);

            // Always trim videos in duration-limited rooms
            if (room !== 'home' && duration > roomConfigs[room].maxDuration) {
                console.log(`Trimming video from ${duration}s to ${roomConfigs[room].maxDuration}s`);
                const trimmedPath = path.join(
                    path.dirname(file.path),
                    'trimmed-' + path.basename(file.path)
                );
                
                await trimVideo(file.path, trimmedPath, roomConfigs[room].maxDuration);
                trimmedFile = trimmedPath;
                finalPath = trimmedPath;
                duration = roomConfigs[room].maxDuration;
                console.log(`Video trimmed successfully. New duration: ${duration}s`);

                // Delete original file after successful trim
                console.log('Deleting original file after trim:', originalFile);
                await safeDeleteFile(originalFile);
                originalFile = null;
            } else {
                console.log(`Video duration (${duration}s) within limits for room ${room}`);
            }
        }

        // Create media item
        const mediaItem = {
            id: path.basename(finalPath),
            path: `/media/${room}/${path.basename(finalPath)}`,
            type: file.mimetype.startsWith('video/') ? 'video' : 'image',
            duration: duration || roomConfigs[room].maxDuration,
            timestamp: Date.now(),
            userId: user._id,
            username: user.username
        };

        return { mediaItem, originalFile, trimmedFile };
    } catch (error) {
        // Clean up files if there was an error
        if (originalFile) await safeDeleteFile(originalFile);
        if (trimmedFile) await safeDeleteFile(trimmedFile);
        throw error;
    }
};
