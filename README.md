# 📺 Hasutv - Real-Time Media & Chat Platform

> A full-stack web application for real-time media sharing and live chat with WebSocket support, multiple chat rooms, and dynamic media processing.

![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js) ![React](https://img.shields.io/badge/React-19+-blue?logo=react) ![MongoDB](https://img.shields.io/badge/MongoDB-6+-green?logo=mongodb) ![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8+-white?logo=socket.io) ![License](https://img.shields.io/badge/License-ISC-blue)

## 🎯 Features

- **Real-Time Chat** - Instant messaging with WebSocket support via Socket.IO
- **Multiple Chat Rooms** - Pre-configured rooms with different media duration limits (10s, 30s, 60s, custom)
- **Media Sharing** - Upload and stream media files with automatic FFmpeg processing
- **User Authentication** - JWT-based auth with support for:
  - Email/password registration and login
  - Guest mode
- **Live Media Queue** - Queue-based media system with automatic playback and duration management
- **Emoji Picker** - Rich emoji support in chat messages
- **File Upload Handling** - Secure file uploads with validation and rate limiting
- **Security Features**:
  - Rate limiting on API endpoints
  - CORS protection
  - Helmet.js security headers
  - Input sanitization & XSS protection
  - JWT token refresh mechanism
- **Auto Cleanup System** - Automatic deletion of old media files (24-hour retention)
- **Responsive UI** - Mobile-friendly interface with Tailwind CSS

## 🏗️ Architecture

### Backend Stack
- **Framework**: Express.js 4.21+
- **Database**: MongoDB 6+ with Mongoose ODM
- **Real-Time**: Socket.IO 4.8+, WebSockets
- **Authentication**: JWT
- **Media Processing**: FFmpeg, fluent-ffmpeg
- **Security**: Helmet.js, express-rate-limit, cors
- **File Upload**: Multer
- **Validation**: express-validator

### Frontend Stack
- **Framework**: React 19+
- **Styling**: Tailwind CSS 3.4+
- **Real-Time**: Socket.IO Client 4.8+
- **Routing**: React Router DOM 7.3+
- **Media Player**: React Player 2.16+
- **HTTP Client**: Axios 1.7+
- **UI Components**: Heroicons, Emoji Picker React, React Dropzone

## 📦 Project Structure

```
hasutv/
├── backend/
│   ├── server.js                 # Express server entry point
│   ├── package.json              # Backend dependencies
│   ├── models/                   # MongoDB schemas
│   │   ├── User.js              # User model with auth support
│   │   ├── ChatMessage.js        # Chat message storage
│   │   └── Room.js              # Room configuration
│   ├── src/
│   │   ├── config/              # Configuration files
│   │   │   ├── app.config.js     # App settings & room configs
│   │   │   ├── db.config.js      # MongoDB connection
│   │   │   └── index.js
│   │   ├── controllers/          # Request handlers
│   │   ├── routes/              # API endpoints
│   │   ├── middleware/          # Custom middleware
│   │   ├── services/            # Business logic
│   │   ├── socket/              # Socket.IO handlers
│   │   ├── utils/               # Helper functions
│   │   └── tests/               # API tests
│   └── uploads/                 # Media storage directory
│
├── frontend/
│   ├── package.json              # Frontend dependencies
│   ├── public/                  # Static assets
│   ├── src/
│   │   ├── components/          # React components
│   │   ├── App.js               # Main app component
│   │   └── index.js             # React entry point
│   ├── tailwind.config.js        # Tailwind configuration
│   └── build/                   # Production build
│
└── package.json                  # Root dependencies
```

## 🚀 Installation

### Prerequisites
- Node.js 18+ and npm/yarn
- MongoDB 6+ (local or cloud instance)
- FFmpeg (for media processing)

### Step 1: Clone Repository
```bash
git clone <repository-url>
cd hasutv
```

### Step 2: Backend Setup
```bash
cd backend
npm install

# Copy environment template
cp .env.example .env
```

Configure `.env` with your settings (see [Configuration](#-configuration) section).

### Step 3: Install FFmpeg
```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get install ffmpeg

# Windows
choco install ffmpeg
```

### Step 4: Frontend Setup
```bash
cd ../frontend
npm install
```

### Step 5: Start Development Servers

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
# Runs on http://localhost:3001
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
# Opens http://localhost:3000
```

## 💻 Usage

### Starting the Application

**Development Mode:**
```bash
# Backend (with hot-reload)
cd backend && npm run dev

# Frontend (with hot-reload)
cd frontend && npm start
```

**Production Mode:**
```bash
# Build frontend
cd frontend && npm run build

# Start backend
cd backend && npm start
```

### User Registration & Login

1. Visit `http://localhost:3000`
2. Click **Register** to create an account
3. Enter username and password
4. Choose a chat room to join

### Uploading Media

1. Click the upload button in your selected room
2. Choose a media file (image, video, audio)
3. File will be processed and added to the media queue
4. Media automatically plays based on room duration settings

### Sending Messages

1. Type message in the input box
2. Add emoji with the emoji picker
3. Press Enter or click Send
4. Message appears in real-time for all room users

### Rooms

**Pre-configured Rooms:**
- `home` - 30 second media duration
- `10-second-room` - 10 second media duration
- `30-second-room` - 30 second media duration
- `60-second-room` - 60 second media duration

Each room maintains its own media queue and chat history.

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the `backend/` directory:

```bash
# Server
PORT=3001
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/hasutv
# Or MongoDB Cloud
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/hasutv

# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=http://localhost:3000

# Media Upload
MAX_FILE_SIZE=104857600  # 100MB in bytes
UPLOAD_DIR=./uploads

# Cleanup System
CLEANUP_INTERVAL=3600000      # 1 hour
MAX_FILE_AGE=86400000         # 24 hours
MAX_CONCURRENT_DELETES=5
```

### App Configuration (`backend/src/config/app.config.js`)

Modify room configurations:
```javascript
export const roomConfigs = {
    'custom-room': {
        interval: 20000,      // Media duration in ms
        maxDuration: 20,      // Max duration in seconds
        mediaQueue: [],
        currentMedia: null,
        processingQueue: false,
        timer: null,
        sequenceNumber: 0
    }
};
```

## 🔌 API Reference

### Authentication Endpoints

**Register User**
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "john_doe",
  "password": "secure_password"
}
```

**Login**
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "john_doe",
  "password": "secure_password"
}
```

Response:
```json
{
  "success": true,
  "token": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "user": {
    "id": "user_id",
    "username": "john_doe"
  }
}
```

**Guest Login**
```http
POST /api/auth/guest
Content-Type: application/json

{
  "username": "guest_username"
}
```

### Chat Endpoints

**Get Room Messages**
```http
GET /api/chat/:roomName/messages
Authorization: Bearer {token}
```

**Send Message** (via Socket.IO)
```javascript
socket.emit('send_message', {
  message: 'Hello, world!',
  roomName: 'home'
});
```

### Media Endpoints

**Upload Media**
```http
POST /api/media/upload/:roomName
Authorization: Bearer {token}
Content-Type: multipart/form-data

[File data]
```

**Get Room Media Queue**
```http
GET /api/media/queue/:roomName
Authorization: Bearer {token}
```

**Stream Media File**
```http
GET /api/media/files/:filename
Authorization: Bearer {token}
```

### WebSocket Events

**Join Room**
```javascript
socket.emit('join_room', {
  roomName: 'home',
  username: 'john_doe'
});
```

**Send Message**
```javascript
socket.emit('send_message', {
  message: 'Hello!',
  roomName: 'home'
});
```

**Receive Message**
```javascript
socket.on('receive_message', (data) => {
  console.log(`${data.username}: ${data.message}`);
});
```

**Media Queue Updated**
```javascript
socket.on('media_queue_updated', (queue) => {
  console.log('New queue:', queue);
});
```

## 🔒 Security

The application implements multiple layers of security:

- **Rate Limiting**: Prevents API abuse with configurable limits
- **CORS**: Whitelist allowed origins
- **JWT Tokens**: Secure token-based authentication with refresh mechanism
- **Helmet.js**: Sets security HTTP headers
- **Input Sanitization**: XSS protection via express-validator
- **Password Hashing**: bcryptjs for secure password storage
- **File Validation**: Validates file types and sizes
- **Rate Limiting**: Special limits for upload endpoints

## 🧪 Testing

### Run Backend Tests
```bash
cd backend
npm test
```

### Run Frontend Tests
```bash
cd frontend
npm test
```

### CORS & Rate Limit Testing
```bash
cd backend/tests
node cors-test.js
node rate-limit-test.js
```

