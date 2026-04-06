const mongoose = require('mongoose');

const artifactSchema = new mongoose.Schema({
  originalName: { type: String, required: true },
  storedName: { type: String, required: true, unique: true },
  uploaderId: { type: String, required: true },
  mimeType: { type: String, default: 'application/octet-stream' },
  size: { type: Number, required: true },
  url: { type: String, required: true },
  depositedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

artifactSchema.index({ uploaderId: 1 });

module.exports = mongoose.model('Artifact', artifactSchema);
