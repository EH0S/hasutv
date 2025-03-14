import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import User from '../../models/User.js';

// Helper function to get client IP
export const getClientIp = (req) => {
    return req.headers['x-forwarded-for'] || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress;
};

// Update user's IP address
export const updateUserIp = async (userId, ip) => {
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
export const generateGuestUsername = async () => {
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

// Generate a unique ID
export const generateId = () => uuidv4();
