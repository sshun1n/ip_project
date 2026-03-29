const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SALT_ROUNDS = 10;

// Создаём директорию data, если не существует
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Хранилище пользователей в памяти, синхронизируется с файлом
let users = new Map();

/**
 * Загрузка пользователей из JSON-файла
 */
function load() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
      users = new Map(data.map(u => [u.id, u]));
    }
  } catch (err) {
    console.error('Ошибка загрузки пользователей:', err.message);
    users = new Map();
  }
}

/**
 * Сохранение пользователей в JSON-файл
 */
function save() {
  try {
    const data = Array.from(users.values());
    fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Ошибка сохранения пользователей:', err.message);
  }
}

/**
 * Регистрация нового пользователя
 * @returns {{ success: boolean, user?: object, error?: string }}
 */
async function register(username, password) {
  if (!username || username.length < 2 || username.length > 24) {
    return { success: false, error: 'Позывной должен быть от 2 до 24 символов.' };
  }
  if (!password || password.length < 4) {
    return { success: false, error: 'Код доступа — минимум 4 символа.' };
  }

  // Проверка уникальности позывного (без учёта регистра)
  const nameLower = username.toLowerCase().trim();
  const exists = Array.from(users.values()).some(u => u.username.toLowerCase() === nameLower);
  if (exists) {
    return { success: false, error: 'Этот позывной уже занят другим странником.' };
  }

  const id = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = {
    id,
    username: username.trim(),
    passwordHash,
    inventory: [],
    uploadedIds: [],
    createdAt: new Date().toISOString()
  };

  users.set(id, user);
  save();

  return { success: true, user: sanitize(user) };
}

/**
 * Аутентификация пользователя
 * @returns {{ success: boolean, user?: object, error?: string }}
 */
async function authenticate(username, password) {
  if (!username || !password) {
    return { success: false, error: 'Введите позывной и код доступа.' };
  }

  const nameLower = username.toLowerCase().trim();
  const user = Array.from(users.values()).find(u => u.username.toLowerCase() === nameLower);

  if (!user) {
    return { success: false, error: 'Странник с таким позывным не найден.' };
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return { success: false, error: 'Неверный код доступа.' };
  }

  return { success: true, user: sanitize(user) };
}

/**
 * Получение пользователя по ID
 */
function getById(id) {
  return users.get(id) || null;
}

/**
 * Безопасная версия пользователя (без хеша пароля)
 */
function sanitize(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}

/**
 * Добавление артефакта в инвентарь пользователя
 */
function addToInventory(userId, artifact) {
  const user = users.get(userId);
  if (!user) return false;

  user.inventory.push({
    id: artifact.id,
    name: artifact.originalName,
    url: artifact.url,
    size: artifact.size,
    mimeType: artifact.mimeType,
    receivedAt: new Date().toISOString()
  });

  save();
  return true;
}

/**
 * Сохранение ID загруженного артефакта в профиль пользователя
 */
function addUploadedId(userId, artifactId) {
  const user = users.get(userId);
  if (!user) return;
  user.uploadedIds.push(artifactId);
  save();
}

/**
 * Получение инвентаря пользователя
 */
function getInventory(userId) {
  const user = users.get(userId);
  return user ? user.inventory : [];
}

/**
 * Получение списка ID загруженных артефактов пользователя
 */
function getUploadedIds(userId) {
  const user = users.get(userId);
  return user ? user.uploadedIds : [];
}

// Загрузка при инициализации модуля
load();

module.exports = {
  register,
  authenticate,
  getById,
  sanitize,
  addToInventory,
  addUploadedId,
  getInventory,
  getUploadedIds,
  load,
  save,
  _users: users
};
