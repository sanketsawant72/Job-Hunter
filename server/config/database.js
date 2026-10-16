/**
 * MongoDB Connection Configuration
 * Supports both local MongoDB and MongoDB Atlas via environment variable
 */
const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ai-job-mailer';

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000, // Fail fast if MongoDB not running
    });

    logger.info(`MongoDB Connected: ${conn.connection.host} | DB: ${conn.connection.name}`);

    // Connection event listeners
    mongoose.connection.on('error', (err) => {
      logger.error(`MongoDB connection error: ${err.message}`);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

  } catch (error) {
    // Provide meaningful error message if MongoDB is not running
    if (error.name === 'MongoServerSelectionError') {
      logger.error('═══════════════════════════════════════════════════════');
      logger.error('  MongoDB is NOT running or unreachable!');
      logger.error(`  URI attempted: ${uri}`);
      logger.error('  Please start MongoDB:');
      logger.error('    Windows : net start MongoDB');
      logger.error('    macOS   : brew services start mongodb-community');
      logger.error('    Linux   : sudo systemctl start mongod');
      logger.error('  Or install from: https://www.mongodb.com/try/download/community');
      logger.error('═══════════════════════════════════════════════════════');
    } else {
      logger.error(`MongoDB Connection Failed: ${error.message}`);
    }
    process.exit(1);
  }
};

module.exports = connectDB;
