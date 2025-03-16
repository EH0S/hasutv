import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { PORT } from './src/config/app.config.js';
import { connectDatabase } from './src/config/db.config.js';
import { configureSocketHandlers } from './src/socket/socket-handler.js';
import { initializeServer, cleanupOldFiles } from './src/services/index.js';
import { CLEANUP_CONFIG } from './src/config/app.config.js';
import { 
  securityHeaders, 
  sanitizeInput, 
  corsOptions, 
  rateLimiter
} from './src/middleware/index.js';

// Import the main router
import apiRoutes from './src/routes/index.js';

// ES Module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

// JWT Configuration validation
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
    console.error('JWT_SECRET and JWT_REFRESH_SECRET must be set in environment variables');
    process.exit(1);
}

// Initialize express app
const app = express();

// Apply security middleware
app.use(securityHeaders);
app.use(sanitizeInput);
// Apply general rate limiter as default
app.use(rateLimiter);

// Configure CORS
app.use(cors(corsOptions));

// Create HTTP server and Socket.IO instance
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling']
});

// Share io instance with routes
app.set('io', io);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Register API routes with prefix
app.use('/api', apiRoutes);

// Backward compatibility for direct media access
app.use('/media', (req, res, next) => {
  req.url = '/media' + req.url;
  apiRoutes(req, res, next);
});

// Room configurations
const roomConfigs = {
    'home': {
        interval: 30000,  // 30 seconds
        maxDuration: 30,  // 30 seconds
        mediaQueue: [],
        currentMedia: null,
        processingQueue: false,
        timer: null,
        sequenceNumber: 0  // Add sequence number for tracking media state updates
    },
    '10-second-room': {
        interval: 10000,  // 10 seconds
        maxDuration: 10,  // 10 seconds
        mediaQueue: [],
        currentMedia: null,
        processingQueue: false,
        timer: null,
        sequenceNumber: 0  // Add sequence number for tracking media state updates
    },
    '30-second-room': {
        interval: 30000,  // 30 seconds
        maxDuration: 30,  // 30 seconds
        mediaQueue: [],
        currentMedia: null,
        processingQueue: false,
        timer: null,
        sequenceNumber: 0  // Add sequence number for tracking media state updates
    },
    '60-second-room': {
        interval: 60000,  // 60 seconds
        maxDuration: 60,  // 60 seconds
        mediaQueue: [],
        currentMedia: null,
        processingQueue: false,
        timer: null,
        sequenceNumber: 0  // Add sequence number for tracking media state updates
    }
};

// Configure Socket.IO
configureSocketHandlers(io, roomConfigs);

// Start the cleanup interval
setInterval(cleanupOldFiles, CLEANUP_CONFIG.INTERVAL);

// Connect to database and start server
connectDatabase()
    .then(() => {
        return initializeServer();
    })
    .then(() => {
        server.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    })
    .catch(error => {
        console.error('Server initialization failed:', error);
        process.exit(1);
    });

// Handle process termination
process.on('SIGINT', () => {
    console.log('Gracefully shutting down');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
