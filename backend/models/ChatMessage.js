import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    username: {
        type: String,
        required: true
    },
    text: {
        type: String,
        required: true,
        maxLength: 100
    },
    ip: {
        type: String,
        required: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Create indexes
chatMessageSchema.index({ createdAt: -1 });

// Static method to maintain only the last 50 messages
chatMessageSchema.statics.maintainMessageLimit = async function() {
    const count = await this.countDocuments();
    if (count > 50) {
        const messagesToDelete = await this.find({})
            .sort({ createdAt: 1 })
            .limit(count - 50);
        
        if (messagesToDelete.length > 0) {
            await this.deleteMany({
                _id: { $in: messagesToDelete.map(msg => msg._id) }
            });
        }
    }
};

export default mongoose.model('ChatMessage', chatMessageSchema);
