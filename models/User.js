const mongoose = require('mongoose');

const inventoryItemSchema = new mongoose.Schema({
  artifactId: { type: String, required: true },
  name: { type: String, required: true },
  url: { type: String, required: true },
  size: { type: Number, required: true },
  mimeType: { type: String, default: 'application/octet-stream' },
  receivedAt: { type: Date, default: Date.now }
}, { _id: false });

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 2,
    maxlength: 24
  },
  passwordHash: { type: String, required: true },
  inventory: { type: [inventoryItemSchema], default: [] },
  uploadedIds: { type: [String], default: [] }
}, {
  timestamps: true
});

userSchema.index({ username: 1 }, { collation: { locale: 'en', strength: 2 } });

module.exports = mongoose.model('User', userSchema);
