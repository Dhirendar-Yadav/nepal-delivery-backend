// ==========================================
// Native MongoDB Driver - DNS Bypass Test
// ==========================================
require('dotenv').config(); // Load environment variables securely

const dns = require('dns');
const { MongoClient } = require('mongodb');

// 1. DNS Bypass: Route through Google Public DNS to bypass local network restrictions
dns.setServers(['8.8.8.8', '8.8.4.4']); 

// 2. Fetch the secure Database URI from the .env file (No hardcoded passwords!)
const uri = process.env.MONGO_URI;

if (!uri) {
    console.error("❌ ERROR: MONGO_URI is missing in the .env file.");
    process.exit(1);
}

const client = new MongoClient(uri);

async function run() {
  try {
    console.log("🔄 Bypassing local DNS and routing through Google Public DNS...");
    await client.connect();
    
    console.log("*****************************************");
    console.log("✅ SYSTEM DNS OVERRIDE SUCCESSFUL!");
    console.log("🌍 Successfully connected to MongoDB Atlas via Native Driver.");
    console.log("*****************************************");
    
  } catch (err) {
    console.error("❌ CONNECTION ERROR:");
    console.error(err);
  } finally {
    // Ensure the client closes gracefully after the test
    await client.close();
  }
}

run();