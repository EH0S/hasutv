// Room configurations
export const roomConfigs = {
    'home': {
        interval: 30000,  // 30 seconds
        maxDuration: 30,  // 30 seconds
        mediaQueue: [],
        currentMedia: null,
        processingQueue: false,
        timer: null
    },
    '10-second-room': {
        interval: 10000,  // 10 seconds
        maxDuration: 10,  // 10 seconds
        mediaQueue: [],
        currentMedia: null,
        processingQueue: false,
        timer: null
    },
    '30-second-room': {
        interval: 30000,  // 30 seconds
        maxDuration: 30,  // 30 seconds
        mediaQueue: [],
        currentMedia: null,
        processingQueue: false,
        timer: null
    },
    '60-second-room': {
        interval: 60000,  // 60 seconds
        maxDuration: 60,  // 60 seconds
        mediaQueue: [],
        currentMedia: null,
        processingQueue: false,
        timer: null
    }
};

// Cleanup system configuration
export const CLEANUP_CONFIG = {
    INTERVAL: 60 * 60 * 1000, // 1 hour
    MAX_AGE: 24 * 60 * 60 * 1000, // 24 hours
    MAX_CONCURRENT_DELETES: 5,
    MAX_RETRIES: 3,
    RETRY_DELAY: 5000, // 5 seconds
};

export const JWT_CONFIG = {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
};

export const PORT = process.env.PORT || 3001;

// Utility function to validate room name
export const isValidRoom = (roomName) => {
    return roomName === 'home' || roomConfigs.hasOwnProperty(roomName);
};
