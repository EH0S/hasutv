import fetch from 'node-fetch';
import express from 'express';
import { userDataRateLimiter } from '../src/middleware/security.js';

// Create a test server to simulate the API
const app = express();
const port = 3999; // Different from main server
let server;

// Test constants
const API_URL = `http://localhost:${port}`;
const AUTH_ENDPOINT = '/api/auth/login';
const TEST_ENDPOINT = '/api/auth/user';
const REQUESTS_TO_SEND = 110; // More than our limit of 100

const TEST_USER = {
    username: 'testuser',
    password: 'testpass123'
};

// Set up mock routes
app.post('/api/auth/signup', (req, res) => {
    res.status(200).json({ message: 'User created' });
});

app.post('/api/auth/login', (req, res) => {
    res.status(200).json({ token: 'test-token-12345' });
});

// Apply rate limiting to this endpoint
app.get('/api/auth/user', userDataRateLimiter, (req, res) => {
    res.status(200).json({ user: { id: '123', username: 'testuser' } });
});

async function getAuthToken() {
    try {
        const response = await fetch(`${API_URL}${AUTH_ENDPOINT}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(TEST_USER)
        });

        if (!response.ok) {
            throw new Error(`Auth failed: ${response.status}`);
        }

        const data = await response.json();
        return data.token;
    } catch (error) {
        console.error('Failed to get auth token:', error.message);
        throw error;
    }
}

async function createTestUser() {
    try {
        const response = await fetch(`${API_URL}/api/auth/signup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(TEST_USER)
        });

        if (response.status === 409) {
            console.log('Test user already exists, proceeding with login...');
            return;
        }

        if (!response.ok) {
            throw new Error(`Failed to create test user: ${response.status}`);
        }

        console.log('Test user created successfully');
    } catch (error) {
        console.error('Error creating test user:', error.message);
        throw error;
    }
}

async function testRateLimit() {
    try {
        // First ensure test user exists
        await createTestUser();

        // Get auth token
        const token = await getAuthToken();
        console.log('Successfully obtained auth token');

        console.log(`Testing rate limiting by sending ${REQUESTS_TO_SEND} requests...`);
        const startTime = Date.now();
        const responses = [];

        for (let i = 0; i < REQUESTS_TO_SEND; i++) {
            try {
                const response = await fetch(`${API_URL}${TEST_ENDPOINT}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                const status = response.status;
                responses.push(status);
                
                // Log every 10th response
                if (i % 10 === 0) {
                    console.log(`Request ${i}: Status ${status}`);
                    if (status === 429) {
                        console.log('Rate limit headers:', {
                            'Retry-After': response.headers.get('Retry-After'),
                            'X-RateLimit-Limit': response.headers.get('X-RateLimit-Limit'),
                            'X-RateLimit-Remaining': response.headers.get('X-RateLimit-Remaining'),
                        });
                    }
                }
            } catch (error) {
                console.error(`Request ${i} failed:`, error.message);
            }
            
            // Add a small delay between requests to avoid overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        const duration = (Date.now() - startTime) / 1000;
        const successfulRequests = responses.filter(status => status === 200).length;
        const rateLimitedRequests = responses.filter(status => status === 429).length;

        console.log('\nTest Results:');
        console.log(`Duration: ${duration.toFixed(2)} seconds`);
        console.log(`Successful requests: ${successfulRequests}`);
        console.log(`Rate limited requests: ${rateLimitedRequests}`);
        
        // Exit process after test completion
        process.exit(0);
    } catch (error) {
        console.error('Test failed:', error.message);
        process.exit(1);
    }
}

// Start test server then run tests
server = app.listen(port, () => {
    console.log(`Test server running on port ${port}`);
    testRateLimit();
});

// Clean up server on exit
process.on('exit', () => {
    if (server) {
        server.close();
    }
});
