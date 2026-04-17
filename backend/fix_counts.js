const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const User = require('./models/User');

const fixCounts = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');
        
        const result = await User.updateMany(
            { $or: [
                { friendsCount: { $exists: false } },
                { followersCount: { $exists: false } },
                { groupsCount: { $exists: false } }
            ]},
            { $set: { 
                friendsCount: 0, 
                followersCount: 0, 
                groupsCount: 0 
            }}
        );
        
        console.log(`Updated ${result.modifiedCount} users with default counts.`);
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

fixCounts();
