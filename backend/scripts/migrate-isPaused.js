require('dotenv').config();

const mongoose = require('mongoose');
const Restaurant = require('../models/Restaurant');

async function migrate() {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        console.log('✅ MongoDB Connected');

        const result = await Restaurant.updateMany(
            {
                isPaused: { $exists: false }
            },
            {
                $set: {
                    isPaused: false
                }
            }
        );

        console.log('--------------------------------');
        console.log('Matched :', result.matchedCount);
        console.log('Modified:', result.modifiedCount);
        console.log('Migration Complete ✅');
        console.log('--------------------------------');

        await mongoose.disconnect();
        process.exit(0);

    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

migrate();