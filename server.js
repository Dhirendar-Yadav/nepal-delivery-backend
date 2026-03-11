// 1. Load Environment Variables (Secure configuration)
require('dotenv').config();

// 2. DNS Bypass (Temporary fix for local network restrictions)
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Middleware to parse incoming JSON requests
app.use(express.json()); 
app.use(cors());

// 3. MongoDB Atlas Database Connection
const dbURI = process.env.MONGO_URI;

mongoose.connect(dbURI)
.then(() => {
    console.log("*****************************************");
    console.log("✅ MONGOOSE CONNECTED SUCCESSFULLY!");
    console.log("🚀 Nepal Delivery Backend is officially LIVE!");
    console.log("*****************************************");
})
.catch(err => console.error("Database connection error: ", err.message));

// ==========================================
// 4. DATABASE SCHEMA (Data Models)
// ==========================================

// Blueprint for Restaurant data
const restaurantSchema = new mongoose.Schema({
    name: { type: String, required: true },
    location: { type: String, required: true },
    foodType: { type: String, required: true }
});

const Restaurant = mongoose.model('Restaurant', restaurantSchema);

// ==========================================
// 5. API ROUTES (Endpoints)
// ==========================================

// Root endpoint for server health check
app.get('/', (req, res) => res.send("Nepal Delivery API is running smoothly! 🚀"));

// (A) POST: Add a new restaurant to the database
app.post('/api/add-restaurant', async (req, res) => {
    try {
        const { name, location, foodType } = req.body;
        
        const newRestaurant = new Restaurant({ name, location, foodType });
        await newRestaurant.save();
        
        console.log(`New restaurant registered: ${name} 🍕`);
        res.status(201).json({ message: "Restaurant successfully registered in the cloud!", data: newRestaurant });
    } catch (err) {
        console.error("Error saving data:", err.message);
        res.status(500).json({ error: "Failed to register the restaurant." });
    }
});

// (B) GET: Fetch all restaurants from the database
app.get('/api/restaurants', async (req, res) => {
    try {
        const allRestaurants = await Restaurant.find();
        
        console.log("Client requested the list of all restaurants. 🛵");
        res.status(200).json(allRestaurants);
    } catch (err) {
        console.error("Error fetching data:", err.message);
        res.status(500).json({ error: "Failed to fetch restaurant data." });
    }
});

// ==========================================
// 6. SERVER INITIALIZATION
// ==========================================
const PORT = 5000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}...`));