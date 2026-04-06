const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/artifact-swap';

async function connect() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('◈ MongoDB подключена:', MONGO_URI.replace(/\/\/.*@/, '//***@'));
  } catch (err) {
    console.error('Ошибка подключения к MongoDB:', err.message);
    process.exit(1);
  }
}

function getConnection() {
  return mongoose.connection;
}

module.exports = { connect, getConnection, MONGO_URI };
