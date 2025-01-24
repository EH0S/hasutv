import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    description: {
        type: String,
        required: true
    },
    maxContentDuration: {
        type: Number,
        required: true
    },
    lastMessages: [{
        userId: mongoose.Schema.Types.ObjectId,
        username: String,
        text: String,
        ip: String,
        createdAt: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true
});

// Ensure lastMessages array doesn't exceed 50 messages
roomSchema.pre('save', function(next) {
    if (this.lastMessages.length > 50) {
        this.lastMessages = this.lastMessages.slice(-50);
    }
    next();
});

const Room = mongoose.model('Room', roomSchema);

export default Room;
