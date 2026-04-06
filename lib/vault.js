const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Artifact = require('../models/Artifact');

const ARTIFACTS_DIR = path.join(__dirname, '..', 'public', 'artifacts');

if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 mb

function isAllowedType(mimeType) {
  if (!mimeType) return true;
  if (mimeType.startsWith('video/')) return false;
  return true;
}

async function deposit(tempPath, originalName, uploaderId, mimeType, size) {
  if (size > MAX_FILE_SIZE) {
    return { error: 'Груз слишком тяжёл. Максимум 10 МБ, странник.' };
  }

  if (!isAllowedType(mimeType)) {
    return { error: 'Видеосигналы запрещены на этой станции. Только изображения, тексты и файлы.' };
  }

  const id = crypto.randomUUID();
  const ext = path.extname(originalName) || '';
  const storedName = id + ext;
  const destPath = path.join(ARTIFACTS_DIR, storedName);

  // файл из tmp в постоянное хранилище
  fs.copyFileSync(tempPath, destPath);
  fs.unlinkSync(tempPath);

  const artifact = await Artifact.create({
    originalName,
    storedName,
    uploaderId,
    mimeType: mimeType || 'application/octet-stream',
    size,
    url: `/artifacts/${storedName}`
  });

  return {
    id: artifact._id.toString(),
    originalName: artifact.originalName,
    storedName: artifact.storedName,
    uploaderId: artifact.uploaderId,
    mimeType: artifact.mimeType,
    size: artifact.size,
    url: artifact.url,
    depositedAt: artifact.depositedAt
  };
}

// случайный артефакт, исключая свои и уже полученные
async function withdraw(excludeUploaderIds = [], excludeArtifactIds = []) {
  const query = {};

  if (excludeUploaderIds.length > 0) {
    query.uploaderId = { $nin: excludeUploaderIds };
  }

  if (excludeArtifactIds.length > 0) {
    query._id = { $nin: excludeArtifactIds };
  }

  const count = await Artifact.countDocuments(query);
  if (count === 0) return null;

  const randomIndex = Math.floor(Math.random() * count);
  const artifact = await Artifact.findOne(query).skip(randomIndex).lean();

  if (!artifact) return null;

  return {
    id: artifact._id.toString(),
    originalName: artifact.originalName,
    storedName: artifact.storedName,
    uploaderId: artifact.uploaderId,
    mimeType: artifact.mimeType,
    size: artifact.size,
    url: artifact.url,
    depositedAt: artifact.depositedAt
  };
}

async function listAll() {
  const artifacts = await Artifact.find().lean();
  return artifacts.map(a => ({ ...a, id: a._id.toString() }));
}

async function getById(id) {
  try {
    const artifact = await Artifact.findById(id).lean();
    if (!artifact) return null;
    return {
      id: artifact._id.toString(),
      originalName: artifact.originalName,
      storedName: artifact.storedName,
      uploaderId: artifact.uploaderId,
      mimeType: artifact.mimeType,
      size: artifact.size,
      url: artifact.url,
      depositedAt: artifact.depositedAt
    };
  } catch (err) {
    return null;
  }
}

async function stats() {
  const total = await Artifact.countDocuments();
  const uploaders = await Artifact.distinct('uploaderId');
  return { total, uploaders: uploaders.length };
}

// подгружаем файлы которые уже лежат на диске но ещё не в бд
async function loadSeeds() {
  const files = fs.readdirSync(ARTIFACTS_DIR).filter(f => f !== '.gitkeep');

  for (const file of files) {
    const exists = await Artifact.findOne({ storedName: file });
    if (exists) continue;

    const filePath = path.join(ARTIFACTS_DIR, file);
    const stat = fs.statSync(filePath);
    if (stat.isFile()) {
      const ext = path.extname(file);
      await Artifact.create({
        originalName: file,
        storedName: file,
        uploaderId: '__SEED__',
        mimeType: guessMime(ext),
        size: stat.size,
        url: `/artifacts/${file}`
      });
    }
  }
}

function guessMime(ext) {
  const map = {
    '.txt': 'text/plain',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.json': 'application/json',
    '.svg': 'image/svg+xml'
  };
  return map[ext.toLowerCase()] || 'application/octet-stream';
}

module.exports = {
  deposit,
  withdraw,
  listAll,
  getById,
  stats,
  loadSeeds,
  isAllowedType,
  MAX_FILE_SIZE,
  ARTIFACTS_DIR
};
