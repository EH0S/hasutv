import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'your_mongodb_atlas_uri';

export const connectDatabase = async () => {
    try {
        await mongoose.connect(MONGODB_URI, {
            dbName: 'hasutv'  // Specify the database name explicitly
        });
        
        console.log('Connected to MongoDB Atlas');
        console.log('Database:', mongoose.connection.db.databaseName);
        
        // Log all MongoDB operations in development
        mongoose.set('debug', process.env.NODE_ENV !== 'production');
        
        return mongoose.connection;
    } catch (err) {
        console.error('MongoDB connection error:', err);
        process.exit(1);  // Exit if we can't connect to database
    }
};
