const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const ARTIFACTS_DIR = path.join(__dirname, '..', 'public', 'artifacts');

const registry = new Map();

if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 mb

// mime проверка
function isAllowedType(mimeType) {
  if (!mimeType) return true;
  if (mimeType.startsWith('video/')) return false;
  return true;
}

function deposit(tempPath, originalName, uploaderId, mimeType, size) {
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

  fs.copyFileSync(tempPath, destPath);
  fs.unlinkSync(tempPath);

  const artifact = {
    id,
    originalName,
    storedName,
    uploaderId,
    mimeType: mimeType || 'application/octet-stream',
    size,
    url: `/artifacts/${storedName}`,
    depositedAt: new Date().toISOString()
  };

  registry.set(id, artifact);
  return artifact;
}

function withdraw(excludeUploaderIds = [], excludeArtifactIds = []) {
  const candidates = [];

  for (const [id, artifact] of registry) {
    if (excludeUploaderIds.includes(artifact.uploaderId)) continue;
    if (excludeArtifactIds.includes(id)) continue;
    candidates.push(artifact);
  }

  if (candidates.length === 0) return null;

  const randomIndex = Math.floor(Math.random() * candidates.length);
  return candidates[randomIndex];
}


function listAll() {
  return Array.from(registry.values());
}

function getById(id) {
  return registry.get(id) || null;
}

function stats() {
  return {
    total: registry.size,
    uploaders: new Set(Array.from(registry.values()).map(a => a.uploaderId)).size
  };
}

function loadSeeds() {
  const files = fs.readdirSync(ARTIFACTS_DIR).filter(f => f !== '.gitkeep');
  for (const file of files) {
    // Пропускаем уже зарегистрированные файлы
    if (registry.size > 0) {
      const exists = Array.from(registry.values()).some(a => a.storedName === file);
      if (exists) continue;
    }
    const filePath = path.join(ARTIFACTS_DIR, file);
    const stat = fs.statSync(filePath);
    if (stat.isFile()) {
      const ext = path.extname(file);
      const id = path.basename(file, ext);
      const artifact = {
        id,
        originalName: file,
        storedName: file,
        uploaderId: '__SEED__',
        mimeType: guessMime(ext),
        size: stat.size,
        url: `/artifacts/${file}`,
        depositedAt: new Date().toISOString()
      };
      registry.set(id, artifact);
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
  ARTIFACTS_DIR,
  _registry: registry
};
