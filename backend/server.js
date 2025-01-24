import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { check, validationResult } from 'express-validator';
import User from './models/User.js';
import multer from "multer";
import path from "path";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import ChatMessage from './models/ChatMessage.js';
import Room from './models/Room.js';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import ffprobePath from '@ffprobe-installer/ffprobe';

// ES Module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

// Configure ffmpeg paths
ffmpeg.setFfmpegPath(ffmpegPath.path);
ffmpeg.setFfprobePath(ffprobePath.path);

// Initialize global variables
const app = express();
const port = 3001;
const server = createServer(app);
const wss = new WebSocketServer({ server });
const clients = new Map();
const mediaQueues = {};
const uploadsDir = path.join(__dirname, 'uploads');

// Room configurations
const roomConfigs = {
    'home': {
        interval: 30000,  // 30 seconds
        maxDuration: 30,  // 30 seconds
        mediaQueue: [],
        processingQueue: false,
        timer: null
    },
    '10-second-room': {
        interval: 10000,  // 10 seconds
        maxDuration: 10,  // 10 seconds
        mediaQueue: [],
        processingQueue: false,
        timer: null
    },
    '30-second-room': {
        interval: 30000,  // 30 seconds
        maxDuration: 30,  // 30 seconds
        mediaQueue: [],
        processingQueue: false,
        timer: null
    },
    '60-second-room': {
        interval: 60000,  // 60 seconds
        maxDuration: 60,  // 60 seconds
        mediaQueue: [],
        processingQueue: false,
        timer: null
    }
};

const roomIntervals = {
    'home': 30000,              // 30 seconds
    '10-second-room': 10000,    // 10 seconds
    '30-second-room': 30000,    // 30 seconds
    '60-second-room': 60000     // 60 seconds
};

// Helper function to validate room name
const isValidRoom = (roomName) => {
    return roomName === 'home' || roomConfigs.hasOwnProperty(roomName);
};

// Helper function to get client IP
const getClientIp = (req) => {
    return req.headers['x-forwarded-for'] || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress;
};

// Helper function to get video metadata
const getVideoMetadata = async (filePath) => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                console.error('FFprobe error:', err);
                // If ffprobe fails, try to get duration from file stats as fallback
                try {
                    const stats = fs.statSync(filePath);
                    const fileSizeInBytes = stats.size;
                    // Rough estimate: assume 1MB per second for video
                    const estimatedDuration = fileSizeInBytes / (1024 * 1024);
                    console.log('Using estimated duration:', estimatedDuration);
                    resolve({ format: { duration: estimatedDuration } });
                } catch (statErr) {
                    reject(err);
                }
            } else {
                resolve(metadata);
            }
        });
    });
};

// Helper function to trim video
const trimVideo = (inputPath, outputPath, duration) => {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .setStartTime(0)
            .setDuration(duration)
            .output(outputPath)
            .on('end', () => {
                console.log('Video trimming finished');
                // Delete original file after successful trim
                fs.unlink(inputPath, (err) => {
                    if (err) console.error('Error deleting original file:', err);
                });
                resolve();
            })
            .on('error', (err) => {
                console.error('Error trimming video:', err);
                reject(err);
            })
            .run();
    });
};

// Broadcast to room
const broadcastToRoom = (room, message) => {
    let count = 0;
    clients.forEach((client, id) => {
        if (client.room === room && client.ws.readyState === WebSocket.OPEN) {
            try {
                client.ws.send(JSON.stringify(message));
                count++;
            } catch (error) {
                console.error(`Error broadcasting to client ${id}:`, error);
            }
        }
    });
    console.log(`Broadcasted message to ${count} clients in room ${room}`);
};

// Get next media for room
const getNextMedia = async (room) => {
    console.log('\n=== Starting getNextMedia ===');
    console.log(`Room: ${room}`);
    console.log(`Room config:`, roomConfigs[room]);

    if (!roomConfigs[room] || !roomConfigs[room].mediaQueue) {
        console.log('No room config or queue');
        broadcastToRoom(room, {
            type: 'media_state',
            media: null,
            queue: []
        });
        return;
    }

    const queue = roomConfigs[room].mediaQueue;
    console.log(`Queue length: ${queue.length}`);
    console.log('Full queue:', queue);

    if (queue.length === 0) {
        console.log('Queue is empty');
        broadcastToRoom(room, {
            type: 'media_state',
            media: null,
            queue: []
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

    // Verify the media file exists before proceeding
    const mediaPath = path.join(uploadsDir, room, currentMedia.id);
    console.log(`Checking media file: ${mediaPath}`);
    
    try {
        await fs.promises.access(mediaPath);
        console.log('Media file exists, proceeding with playback');

        // Calculate the remaining queue for broadcast
        const remainingQueue = queue.slice(1);
        console.log('Remaining queue:', remainingQueue);

        // Broadcast current media state
        broadcastToRoom(room, {
            type: 'media_state',
            media: currentMedia,
            queue: remainingQueue
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
            getNextMedia(room);
        }, switchInterval);

    } catch (error) {
        console.error(`Media file not found: ${mediaPath}`);
        // Remove missing media and try next
        queue.shift();
        getNextMedia(room);
    }
    
    console.log('=== Finished getNextMedia ===\n');
};

// Clean up media files
const cleanupMediaFiles = async (room, mediaItem) => {
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
const startMediaPlayback = (room) => {
    console.log('\n=== Starting media playback ===');
    console.log(`Room: ${room}`);

    if (!roomConfigs[room]) {
        console.error('Invalid room');
        return;
    }

    const queue = roomConfigs[room].mediaQueue;
    console.log(`Queue length: ${queue?.length}`);
    
    if (!queue || queue.length === 0) {
        console.log('No media in queue');
        broadcastToRoom(room, {
            type: 'media_state',
            media: null,
            queue: []
        });
        return;
    }

    // Don't start new playback if already playing
    if (roomConfigs[room].timer) {
        console.log('Playback already in progress');
        // Send current state to the client without restarting playback
        broadcastToRoom(room, {
            type: 'media_state',
            media: queue[0],
            queue: queue.slice(1)
        });
        return;
    }

    console.log('Starting playback with first item');
    getNextMedia(room);
    console.log('=== Finished starting playback ===\n');
};

// Add media to queue
const addToMediaQueue = (room, mediaItem) => {
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
    broadcastToRoom(room, {
        type: 'queue_update',
        queue: roomConfigs[room].mediaQueue
    });

    // If this is the only item, start playback
    if (queueLength === 1) {
        console.log('First item in queue, starting playback');
        startMediaPlayback(room);
    }
    
    console.log('=== Finished adding media ===\n');
};

// Get room's media queue
const getRoomMediaQueue = (room) => {
    return roomConfigs[room]?.mediaQueue || [];
};

// Clean up file safely
const safeDeleteFile = (filePath) => {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`Successfully deleted file: ${filePath}`);
        } else {
            console.log(`File not found for deletion: ${filePath}`);
        }
    } catch (error) {
        console.error(`Error deleting file ${filePath}:`, error);
    }
};

// Configure CORS
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Initialize rooms in database
const initializeRooms = async () => {
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

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const room = req.params.room;
        const roomDir = path.join(uploadsDir, room);
        
        // Create room directory if it doesn't exist
        if (!fs.existsSync(roomDir)) {
            fs.mkdirSync(roomDir, { recursive: true });
        }
        
        cb(null, roomDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('video/') || file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only video and image files are allowed'));
        }
    }
});

// Initialize server and create necessary directories
const initializeServer = async () => {
    try {
        // Create base uploads directory
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
            console.log('Created uploads directory:', uploadsDir);
        }

        // Create room directories
        Object.keys(roomConfigs).forEach(room => {
            const roomDir = path.join(uploadsDir, room);
            if (!fs.existsSync(roomDir)) {
                fs.mkdirSync(roomDir, { recursive: true });
                console.log('Created room directory:', roomDir);
            }
        });

        // Initialize rooms in database
        await initializeRooms();
        
        // Start server
        server.listen(port, () => {
            console.log(`Server running on port ${port}`);
            console.log('Room configurations:', Object.keys(roomConfigs));
        });

    } catch (error) {
        console.error('Failed to initialize server:', error);
        process.exit(1);
    }
};

// Initialize media queues and start server
initializeServer().catch(error => {
    console.error('Server initialization failed:', error);
    process.exit(1);
});

// JWT secret key - in production, use an environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-key';

// Connect to MongoDB Atlas
const MONGODB_URI = process.env.MONGODB_URI || 'your_mongodb_atlas_uri';
mongoose.connect(MONGODB_URI, {
    dbName: 'hasutv'  // Specify the database name explicitly
})
    .then(() => {
        console.log('Connected to MongoDB Atlas');
        console.log('Database:', mongoose.connection.db.databaseName);
    })
    .catch(err => {
        console.error('MongoDB connection error:', err);
        process.exit(1);  // Exit if we can't connect to database
    });

// Log all MongoDB operations in development
mongoose.set('debug', true);

app.use(express.json());

// Store WebSocket clients with their user info
// Update user's IP address
const updateUserIp = async (userId, ip) => {
  await User.updateOne(
      { _id: userId },
      { 
          $set: { lastActive: new Date() },
          $addToSet: { 
              ipAddresses: {
                  ip: ip,
                  lastUsed: new Date()
              }
          }
      }
  );
};

// Generate a random username
const generateGuestUsername = async () => {
  const adjectives = ['Happy', 'Sleepy', 'Grumpy', 'Sneezy', 'Bashful', 'Purple', 'Green', 'Blue', 'Red', 'Yellow'];
  const nouns = ['Banana', 'Apple', 'Orange', 'Grape', 'Mango', 'Pear', 'Kiwi', 'Lemon', 'Plum', 'Berry'];
  
  let username;
  let isUnique = false;
  
  while (!isUnique) {
      const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
      const noun = nouns[Math.floor(Math.random() * nouns.length)];
      username = `${adj}${noun}${Math.floor(Math.random() * 100)}`;
      
      // Check if username exists
      const existingUser = await User.findOne({ username });
      if (!existingUser) {
          isUnique = true;
      }
  }
  
  return username;
};

// Authentication middleware
const auth = async (req, res, next) => {
  try {
      const token = req.header('Authorization')?.replace('Bearer ', '');
      if (!token) {
          throw new Error();
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.userId);
      
      if (!user) {
          throw new Error();
      }

      req.user = user;
      req.token = token;
      next();
  } catch (error) {
      res.status(401).json({ error: 'Please authenticate' });
  }
};

// Sign up route
app.post('/auth/signup', [
  check('username').isLength({ min: 3 }).trim().escape(),
  check('password').isLength({ min: 6 })
], async (req, res) => {
  try {
      console.log('Signup attempt:', { username: req.body.username });
      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
          console.log('Validation errors:', errors.array());
          return res.status(400).json({ errors: errors.array() });
      }

      const { username, password } = req.body;
      const ip = getClientIp(req);

      // Check if username exists
      const existingUser = await User.findOne({ username });
      if (existingUser) {
          console.log('Username already exists:', username);
          return res.status(400).json({ error: 'Username already exists' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const user = new User({
          username,
          password: hashedPassword,
          ipAddresses: [{ ip, lastUsed: new Date() }]
      });

      console.log('Attempting to save user:', username);
      const savedUser = await user.save();
      console.log('User saved successfully:', savedUser._id);

      // Generate token
      const token = jwt.sign({ userId: user._id }, JWT_SECRET);

      res.status(201).json({ token, user: { id: user._id, username: user.username } });
  } catch (error) {
      console.error('Signup error:', error);
      res.status(500).json({ error: 'Error creating user', details: error.message });
  }
});

// Login route
app.post('/auth/login', async (req, res) => {
  try {
      const { username, password } = req.body;

      // Find user
      const user = await User.findOne({ username });
      if (!user || user.isGuest) {
          return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
          return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Generate token
      const token = jwt.sign({ userId: user._id }, JWT_SECRET);

      res.json({ token, user: { id: user._id, username: user.username } });
  } catch (error) {
      res.status(500).json({ error: 'Error logging in' });
  }
});

// Guest login route
app.post('/auth/guest', async (req, res) => {
  try {
      const username = await generateGuestUsername();
      const ip = getClientIp(req);
      
      // Create guest user
      const user = new User({
          username,
          isGuest: true,
          ipAddresses: [{ ip, lastUsed: new Date() }]
      });

      await user.save();

      // Generate token
      const token = jwt.sign({ userId: user._id }, JWT_SECRET);

      res.json({ token, user: { id: user._id, username: user.username } });
  } catch (error) {
      res.status(500).json({ error: 'Error creating guest user' });
  }
});

// Get current user
app.get('/auth/user', auth, async (req, res) => {
  res.json({ user: { id: req.user._id, username: req.user.username } });
});

// Get chat history
app.get('/chat/history', auth, async (req, res) => {
  try {
      const messages = await ChatMessage.find({})
          .sort({ createdAt: -1 })
          .limit(50);
      res.json(messages.reverse());
  } catch (error) {
      res.status(500).json({ error: 'Error fetching chat history' });
  }
});

// Get user stats
app.get('/user/stats', auth, async (req, res) => {
  try {
      const user = await User.findById(req.user._id);
      const messageCount = await ChatMessage.countDocuments({ userId: req.user._id });
      
      res.json({
          username: user.username,
          messageCount,
          ipAddresses: user.ipAddresses,
          lastActive: user.lastActive,
          createdAt: user.createdAt
      });
  } catch (error) {
      res.status(500).json({ error: 'Error fetching user stats' });
  }
});

// Handle file uploads
app.post('/upload/:room', upload.single('file'), async (req, res) => {
    let originalFile = null;
    let trimmedFile = null;

    try {
        const room = req.params.room;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        originalFile = file.path;

        // Check if it's a valid room
        if (!isValidRoom(room)) {
            safeDeleteFile(originalFile);
            return res.status(400).json({ error: 'Invalid room' });
        }

        // Get file duration if it's a video
        let duration = 0;
        let finalPath = file.path;

        if (file.mimetype.startsWith('video/')) {
            try {
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
                    safeDeleteFile(originalFile);
                    originalFile = null;
                } else {
                    console.log(`Video duration (${duration}s) within limits for room ${room}`);
                }
            } catch (error) {
                console.error('Error processing video:', error);
                safeDeleteFile(originalFile);
                if (trimmedFile) safeDeleteFile(trimmedFile);
                return res.status(400).json({ error: 'Failed to process video' });
            }
        }

        // Create media item
        const mediaItem = {
            id: path.basename(finalPath),
            path: `/media/${room}/${path.basename(finalPath)}`,
            type: file.mimetype.startsWith('video/') ? 'video' : 'image',
            duration: duration || roomConfigs[room].maxDuration,
            timestamp: Date.now()
        };

        // Add to room's media queue
        addToMediaQueue(room, mediaItem);

        console.log(`Media uploaded to room ${room}:`, mediaItem);
        res.json({ 
            message: 'File uploaded successfully', 
            mediaItem,
            queue: getRoomMediaQueue(room)
        });

    } catch (error) {
        console.error('Upload error:', error);
        // Clean up files if they exist
        if (originalFile) safeDeleteFile(originalFile);
        if (trimmedFile) safeDeleteFile(trimmedFile);
        res.status(500).json({ error: 'Upload failed' });
    }
});

// Get room's media queue
app.get('/queue/:room', (req, res) => {
    const room = req.params.room;
    if (!isValidRoom(room)) {
        return res.status(400).json({ error: 'Invalid room' });
    }
    res.json(getRoomMediaQueue(room));
});

// Serve media files
app.get('/media/:room/:filename', (req, res) => {
    const { room, filename } = req.params;
    
    // Validate room and filename
    if (!isValidRoom(room)) {
        return res.status(404).json({ error: 'Room not found' });
    }

    const filePath = path.join(uploadsDir, room, filename);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    res.sendFile(filePath);
});

// Clean up old media files periodically (every hour)
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
setInterval(() => {
    console.log('Running media cleanup...');
    Object.keys(roomConfigs).forEach(room => {
        const roomDir = path.join(uploadsDir, room);
        if (!fs.existsSync(roomDir)) return;

        fs.readdir(roomDir, (err, files) => {
            if (err) {
                console.error(`Error reading directory ${roomDir}:`, err);
                return;
            }

            const now = Date.now();
            const activeFiles = roomConfigs[room].mediaQueue.map(item => item.id);
            const activeTrimmedFiles = activeFiles.map(id => 'trimmed-' + id);
            const allActiveFiles = [...activeFiles, ...activeTrimmedFiles];

            files.forEach(file => {
                const filePath = path.join(roomDir, file);
                
                // Skip files that are currently in the queue
                if (allActiveFiles.includes(file)) {
                    console.log(`Skipping active file: ${file}`);
                    return;
                }

                fs.stat(filePath, (err, stats) => {
                    if (err) {
                        console.error(`Error getting stats for ${filePath}:`, err);
                        return;
                    }

                    // Delete files older than 24 hours
                    const age = now - stats.mtimeMs;
                    if (age > 24 * 60 * 60 * 1000) {
                        fs.unlink(filePath, err => {
                            if (err) {
                                console.error(`Error deleting old file ${filePath}:`, err);
                            } else {
                                console.log(`Deleted old file: ${filePath}`);
                            }
                        });
                    }
                });
            });
        });
    });
}, CLEANUP_INTERVAL);

// Serve static files from uploads directory
app.use('/media', express.static(uploadsDir));

// WebSocket connection handling
wss.on('connection', async (ws, req) => {
    const clientIp = getClientIp(req);
    let currentRoom = 'home';  // Default room
    let currentUser = null;

    // Add client to clients map
    const clientId = uuidv4();
    clients.set(clientId, { ws, room: currentRoom });
    ws.clientId = clientId;

    // Mark connection as alive
    ws.isAlive = true;
    ws.on('pong', () => {
        ws.isAlive = true;
        console.log(`Received pong from client ${clientId}`);
    });

    // Send ping every 30 seconds
    const pingInterval = setInterval(() => {
        if (ws.isAlive === false) {
            console.log(`Client ${clientId} timed out, terminating connection`);
            clearInterval(pingInterval);
            clients.delete(clientId);
            return ws.terminate();
        }
        ws.isAlive = false;
        try {
            ws.ping();
        } catch (error) {
            console.error(`Error sending ping to client ${clientId}:`, error);
            clearInterval(pingInterval);
            clients.delete(clientId);
            ws.terminate();
        }
    }, 30000);

    // Send initial connection confirmation
    try {
        ws.send(JSON.stringify({
            type: 'connected',
            clientId: clientId
        }));
    } catch (error) {
        console.error(`Error sending connection confirmation to client ${clientId}:`, error);
    }

    ws.on('message', async (data) => {
        try {
            const messageStr = data instanceof Buffer ? data.toString() : data;
            const message = JSON.parse(messageStr);
            
            console.log(`Received message from client ${clientId}:`, message);

            if (message.type === 'auth') {
                try {
                    if (!message.token) {
                        throw new Error('No token provided');
                    }

                    const decoded = jwt.verify(message.token, JWT_SECRET);
                    const user = await User.findById(decoded.userId);
                    
                    if (!user) {
                        ws.send(JSON.stringify({ type: 'error', error: 'User not found' }));
                        return;
                    }

                    currentUser = user;
                    console.log(`Client ${clientId} authenticated as ${user.username}`);
                    
                    // Send success response
                    ws.send(JSON.stringify({ type: 'auth_success' }));

                    // Update user's last active time
                    await User.updateOne(
                        { _id: user._id },
                        { 
                            $set: { lastActive: new Date() },
                            $addToSet: { 
                                ipAddresses: {
                                    ip: clientIp,
                                    lastUsed: new Date()
                                }
                            }
                        }
                    );
                } catch (err) {
                    console.error('Auth error:', err);
                    ws.send(JSON.stringify({
                        type: 'error', 
                        error: 'Authentication failed: ' + (err.message || 'Unknown error')
                    }));
                }
            } else if (message.type === 'room_change') {
                try {
                    if (!message.room || !isValidRoom(message.room)) {
                        throw new Error('Invalid room');
                    }

                    // Update client's room in the map
                    const client = clients.get(clientId);
                    if (client) {
                        const oldRoom = client.room;
                        client.room = message.room;
                        currentRoom = message.room;
                        console.log(`Client ${clientId} moved from ${oldRoom} to ${currentRoom}`);

                        // Clear any existing media state when leaving a room
                        broadcastToRoom(oldRoom, {
                            type: 'media_state',
                            media: null,
                            queue: []
                        });

                        // Send room join confirmation
                        ws.send(JSON.stringify({
                            type: 'room_changed',
                            room: currentRoom
                        }));

                        // Start fresh media playback for the new room if there's media
                        if (roomConfigs[currentRoom].mediaQueue?.length > 0) {
                            // Clear any existing timer for this room
                            if (roomConfigs[currentRoom].timer) {
                                clearTimeout(roomConfigs[currentRoom].timer);
                                roomConfigs[currentRoom].timer = null;
                            }
                            startMediaPlayback(currentRoom);
                        }

                        // Get room's chat history
                        const room = await Room.findOne({ name: currentRoom });
                        if (room && room.lastMessages) {
                            console.log(`Sending ${room.lastMessages.length} messages to client ${clientId}`);
                            ws.send(JSON.stringify({
                                type: 'chat_history',
                                messages: room.lastMessages.map(msg => ({
                                    id: msg._id.toString(),
                                    username: msg.username,
                                    text: msg.text,
                                    timestamp: msg.createdAt
                                }))
                            }));
                        }
                    }
                } catch (error) {
                    console.error('Room change error:', error);
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: error.message
                    }));
                }
            } else if (message.type === 'chat_message') {
                try {
                    if (!currentRoom) {
                        throw new Error('Not in a room');
                    }

                    const room = await Room.findOne({ name: currentRoom });
                    if (!room) {
                        throw new Error('Room not found');
                    }

                    // Create chat message with only required fields
                    const chatMessage = new ChatMessage({
                        room: currentRoom,
                        username: currentUser?.username || 'Anonymous',
                        text: message.text
                    });

                    // Add optional fields if available
                    if (currentUser?._id) {
                        chatMessage.userId = currentUser._id;
                    }
                    if (req.socket?.remoteAddress) {
                        chatMessage.ip = req.socket.remoteAddress;
                    }

                    await chatMessage.save();

                    // Update room's last messages
                    await Room.updateOne(
                        { _id: room._id },
                        { $push: { 
                            lastMessages: { 
                                $each: [chatMessage],
                                $slice: -50  // Keep last 50 messages
                            }
                        }}
                    );

                    // Broadcast to room
                    broadcastToRoom(currentRoom, {
                        type: 'chat_message',
                        id: chatMessage._id.toString(),
                        username: chatMessage.username,
                        text: chatMessage.text,
                        timestamp: chatMessage.createdAt
                    });

                } catch (error) {
                    console.error('Chat message error:', error);
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: error.message
                    }));
                }
            } else if (message.type === 'request_next_media') {
                try {
                    console.log(`Client ${clientId} requested next media in room ${currentRoom}`);
                    const nextMedia = getNextMedia(currentRoom);
                    if (nextMedia) {
                        console.log(`Playing next media in room ${currentRoom}:`, nextMedia);
                        startMediaPlayback(currentRoom);
                    } else {
                        console.log(`No more media in queue for room ${currentRoom}`);
                        broadcastToRoom(currentRoom, {
                            type: 'media_state',
                            media: null,
                            queue: []
                        });
                    }
                } catch (error) {
                    console.error('Error handling next media request:', error);
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Failed to play next media'
                    }));
                }
            }
        } catch (err) {
            console.error(`Error handling message from client ${clientId}:`, err);
            try {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ 
                        type: 'error', 
                        message: err.message 
                    }));
                }
            } catch (sendError) {
                console.error(`Error sending error message to client ${clientId}:`, sendError);
            }
        }
    });

    // Handle client disconnect
    ws.on('close', () => {
        console.log(`Client ${clientId} disconnected from room: ${currentRoom}`);
        clearInterval(pingInterval);
        clients.delete(clientId);
    });
});

// Clean up on server shutdown
process.on('SIGTERM', () => {
    clearInterval(PING_INTERVAL);
    Object.keys(roomConfigs).forEach(room => {
        if (room.cycleInterval) {
            clearInterval(room.cycleInterval);
        }
    });
    wss.close();
    server.close();
});