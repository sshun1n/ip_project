const bcrypt = require('bcrypt');
const User = require('../models/User');

const SALT_ROUNDS = 10;

async function register(username, password) {
  if (!username || username.length < 2 || username.length > 24) {
    return { success: false, error: 'Позывной должен быть от 2 до 24 символов.' };
  }
  if (!password || password.length < 4) {
    return { success: false, error: 'Код доступа — минимум 4 символа.' };
  }

  // проверка уникальности без учета регистра
  const nameLower = username.toLowerCase().trim();
  const exists = await User.findOne({
    username: { $regex: new RegExp(`^${nameLower}$`, 'i') }
  });
  if (exists) {
    return { success: false, error: 'Этот позывной уже занят другим странником.' };
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await User.create({
    username: username.trim(),
    passwordHash,
    inventory: [],
    uploadedIds: []
  });

  return { success: true, user: sanitize(user) };
}

async function authenticate(username, password) {
  if (!username || !password) {
    return { success: false, error: 'Введите позывной и код доступа.' };
  }

  const nameLower = username.toLowerCase().trim();
  const user = await User.findOne({
    username: { $regex: new RegExp(`^${nameLower}$`, 'i') }
  });

  if (!user) {
    return { success: false, error: 'Странник с таким позывным не найден.' };
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return { success: false, error: 'Неверный код доступа.' };
  }

  return { success: true, user: sanitize(user) };
}

async function getById(id) {
  const user = await User.findById(id);
  return user || null;
}

// убираем хэш пароля перед отправкой клиенту
function sanitize(user) {
  if (!user) return null;
  const obj = user.toObject ? user.toObject() : { ...user };
  obj.id = obj._id ? obj._id.toString() : obj.id;
  delete obj.passwordHash;
  delete obj.__v;
  return obj;
}

async function addToInventory(userId, artifact) {
  const result = await User.findByIdAndUpdate(userId, {
    $push: {
      inventory: {
        artifactId: artifact.id || artifact._id?.toString(),
        name: artifact.originalName,
        url: artifact.url,
        size: artifact.size,
        mimeType: artifact.mimeType,
        receivedAt: new Date()
      }
    }
  });
  return !!result;
}

async function addUploadedId(userId, artifactId) {
  await User.findByIdAndUpdate(userId, {
    $push: { uploadedIds: artifactId }
  });
}

async function getInventory(userId) {
  const user = await User.findById(userId).lean();
  if (!user) return [];
  return user.inventory.map(item => ({
    id: item.artifactId,
    name: item.name,
    url: item.url,
    size: item.size,
    mimeType: item.mimeType,
    receivedAt: item.receivedAt
  }));
}

async function getUploadedIds(userId) {
  const user = await User.findById(userId).lean();
  return user ? user.uploadedIds : [];
}

module.exports = {
  register,
  authenticate,
  getById,
  sanitize,
  addToInventory,
  addUploadedId,
  getInventory,
  getUploadedIds
};
