const path = require('path');
const fs = require('fs');
const os = require('os');

// ─── Vault Module Tests ──────────────────────────────────────
// Тестируем vault с мок-моделью Artifact (без реальной MongoDB)
describe('Vault Module', () => {
  let vault, Artifact;

  beforeEach(() => {
    jest.resetModules();

    // Мокаем Mongoose-модель Artifact
    const mockArtifacts = new Map();

    jest.doMock('../../models/Artifact', () => {
      const model = {
        create: jest.fn(async (data) => {
          const id = require('crypto').randomUUID();
          const doc = { _id: id, ...data, depositedAt: new Date() };
          mockArtifacts.set(id, doc);
          return doc;
        }),
        findById: jest.fn(async (id) => {
          const doc = mockArtifacts.get(id);
          return doc ? { ...doc, toObject: () => doc } : null;
        }),
        findOne: jest.fn(async (query) => {
          for (const doc of mockArtifacts.values()) {
            if (query.storedName && doc.storedName === query.storedName) return doc;
          }
          return null;
        }),
        countDocuments: jest.fn(async (query = {}) => {
          let count = 0;
          for (const doc of mockArtifacts.values()) {
            if (query.uploaderId && query.uploaderId.$nin) {
              if (query.uploaderId.$nin.includes(doc.uploaderId)) continue;
            }
            if (query._id && query._id.$nin) {
              if (query._id.$nin.includes(doc._id)) continue;
            }
            count++;
          }
          return count;
        }),
        find: jest.fn(() => ({
          lean: jest.fn(async () => Array.from(mockArtifacts.values()))
        })),
        distinct: jest.fn(async (field) => {
          const values = new Set();
          for (const doc of mockArtifacts.values()) {
            if (doc[field]) values.add(doc[field]);
          }
          return Array.from(values);
        }),
        _mockStore: mockArtifacts
      };

      // Мокаем findOne с skip для withdraw
      model.findOne.mockImplementation((query = {}) => {
        const candidates = [];
        for (const doc of mockArtifacts.values()) {
          let ok = true;
          if (query.uploaderId && query.uploaderId.$nin) {
            if (query.uploaderId.$nin.includes(doc.uploaderId)) ok = false;
          }
          if (query._id && query._id.$nin) {
            if (query._id.$nin.includes(doc._id)) ok = false;
          }
          if (query.storedName) {
            ok = doc.storedName === query.storedName;
          }
          if (ok) candidates.push(doc);
        }
        return {
          skip: jest.fn((n) => ({
            lean: jest.fn(async () => candidates[n] || null)
          })),
          lean: jest.fn(async () => candidates[0] || null)
        };
      });

      return model;
    });

    vault = require('../../lib/vault');
    Artifact = require('../../models/Artifact');
  });

  test('isAllowedType blocks video MIME types', () => {
    expect(vault.isAllowedType('video/mp4')).toBe(false);
    expect(vault.isAllowedType('video/webm')).toBe(false);
  });

  test('isAllowedType allows image and text types', () => {
    expect(vault.isAllowedType('image/jpeg')).toBe(true);
    expect(vault.isAllowedType('image/gif')).toBe(true);
    expect(vault.isAllowedType('text/plain')).toBe(true);
    expect(vault.isAllowedType(null)).toBe(true);
  });

  test('deposit stores artifact and returns metadata', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-test-'));
    const tempFile = path.join(tempDir, 'test.txt');
    fs.writeFileSync(tempFile, 'Hello from deep space!');

    const result = await vault.deposit(tempFile, 'test.txt', 'user-123', 'text/plain', 22);
    expect(result.error).toBeUndefined();
    expect(result.id).toBeDefined();
    expect(result.originalName).toBe('test.txt');
    expect(result.uploaderId).toBe('user-123');
    expect(result.url).toMatch(/^\/artifacts\//);
    expect(Artifact.create).toHaveBeenCalled();

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('deposit rejects files over 10MB', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-test-'));
    const tempFile = path.join(tempDir, 'big.txt');
    fs.writeFileSync(tempFile, 'x');

    const result = await vault.deposit(tempFile, 'big.txt', 'user-123', 'text/plain', 11 * 1024 * 1024);
    expect(result.error).toBeDefined();

    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('deposit rejects video files', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-test-'));
    const tempFile = path.join(tempDir, 'vid.mp4');
    fs.writeFileSync(tempFile, 'fake');

    const result = await vault.deposit(tempFile, 'vid.mp4', 'user-123', 'video/mp4', 100);
    expect(result.error).toContain('Видеосигналы');

    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('withdraw returns null when empty', async () => {
    expect(await vault.withdraw(['user-123'], [])).toBeNull();
  });

  test('withdraw excludes artifacts by uploader ID', async () => {
    const store = Artifact._mockStore;
    store.set('a1', { _id: 'a1', originalName: 'f1.txt', storedName: 'a1.txt', uploaderId: 'user-A', url: '/a/1', size: 10, mimeType: 'text/plain' });
    store.set('a2', { _id: 'a2', originalName: 'f2.txt', storedName: 'a2.txt', uploaderId: 'user-B', url: '/a/2', size: 20, mimeType: 'text/plain' });

    const result = await vault.withdraw(['user-A'], []);
    expect(result).not.toBeNull();
    expect(result.id).toBe('a2');
  });

  test('withdraw returns null when only own files exist', async () => {
    const store = Artifact._mockStore;
    store.set('a1', { _id: 'a1', storedName: 'a1.txt', uploaderId: 'user-A', url: '/a/1', size: 10 });

    expect(await vault.withdraw(['user-A'], [])).toBeNull();
  });

  test('stats returns correct counts', async () => {
    const store = Artifact._mockStore;
    store.set('a1', { _id: 'a1', uploaderId: 'user-A' });
    store.set('a2', { _id: 'a2', uploaderId: 'user-B' });
    store.set('a3', { _id: 'a3', uploaderId: 'user-A' });

    const s = await vault.stats();
    expect(s.total).toBe(3);
    expect(s.uploaders).toBe(2);
  });
});

// ─── Flash Middleware Tests ──────────────────────────────────
describe('Flash Middleware', () => {
  let flashMiddleware;

  beforeEach(() => {
    jest.resetModules();
    flashMiddleware = require('../../middleware/flash');
  });

  test('initializes flash and exposes method', () => {
    const req = { session: {} };
    const res = { locals: {} };
    const next = jest.fn();

    flashMiddleware(req, res, next);
    expect(req.session.flash).toEqual([]);
    expect(typeof res.flash).toBe('function');
    expect(next).toHaveBeenCalled();
  });

  test('res.flash adds message to session', () => {
    const req = { session: {} };
    const res = { locals: {} };
    flashMiddleware(req, res, jest.fn());

    res.flash('signal', 'Test');
    expect(req.session.flash).toHaveLength(1);
    expect(req.session.flash[0].type).toBe('signal');
  });

  test('moves previous flash to locals and clears', () => {
    const req = { session: { flash: [{ type: 'signal', message: 'Old', id: 1 }] } };
    const res = { locals: {} };
    flashMiddleware(req, res, jest.fn());

    expect(res.locals.flash).toHaveLength(1);
    expect(res.locals.flash[0].message).toBe('Old');
    expect(req.session.flash).toEqual([]);
  });
});

// ─── Users Module Tests ──────────────────────────────────────
describe('Users Module', () => {
  let users;
  let mockUserStore;

  beforeEach(() => {
    jest.resetModules();
    mockUserStore = new Map();

    jest.doMock('../../models/User', () => {
      const model = {
        create: jest.fn(async (data) => {
          const id = require('crypto').randomUUID();
          const stored = {
            _id: id,
            ...data,
            inventory: data.inventory || [],
            uploadedIds: data.uploadedIds || [],
            createdAt: new Date()
          };
          mockUserStore.set(id, stored);
          return { ...stored, toObject: () => ({ ...stored }) };
        }),
        findOne: jest.fn(async (query) => {
          if (query.username && query.username.$regex) {
            const regex = query.username.$regex;
            for (const user of mockUserStore.values()) {
              if (regex.test(user.username)) {
                return { ...user, toObject: () => ({ ...user }) };
              }
            }
          }
          return null;
        }),
        findById: jest.fn(async (id) => {
          const user = mockUserStore.get(id);
          if (!user) return null;
          return {
            ...user,
            toObject: () => ({ ...user }),
            lean: () => ({ ...user })
          };
        }),
        findByIdAndUpdate: jest.fn(async (id, update) => {
          const user = mockUserStore.get(id);
          if (!user) return null;
          if (update.$push) {
            for (const [key, value] of Object.entries(update.$push)) {
              if (!user[key]) user[key] = [];
              user[key].push(value);
            }
          }
          return user;
        })
      };

      // Для lean запросы
      model.findById.mockImplementation(async (id) => {
        const user = mockUserStore.get(id);
        if (!user) return null;
        return {
          ...user,
          toObject: () => ({ ...user })
        };
      });

      return model;
    });

    users = require('../../lib/users');
  });

  test('register creates user with hashed password', async () => {
    const result = await users.register('TestPilot', 'pass1234');
    expect(result.success).toBe(true);
    expect(result.user.username).toBe('TestPilot');
    expect(result.user.passwordHash).toBeUndefined();
    expect(result.user.id).toBeDefined();
  });

  test('register rejects short username', async () => {
    const result = await users.register('A', 'pass1234');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  test('register rejects short password', async () => {
    const result = await users.register('TestPilot', '12');
    expect(result.success).toBe(false);
  });

  test('register rejects duplicate username', async () => {
    await users.register('TestPilot', 'pass1234');
    const result = await users.register('testpilot', 'pass5678');
    expect(result.success).toBe(false);
    expect(result.error).toContain('занят');
  });

  test('authenticate with correct credentials', async () => {
    await users.register('TestPilot', 'pass1234');
    const result = await users.authenticate('TestPilot', 'pass1234');
    expect(result.success).toBe(true);
    expect(result.user.username).toBe('TestPilot');
  });

  test('authenticate with wrong password', async () => {
    await users.register('TestPilot', 'pass1234');
    const result = await users.authenticate('TestPilot', 'wrong');
    expect(result.success).toBe(false);
  });

  test('authenticate with nonexistent user', async () => {
    const result = await users.authenticate('Ghost', 'pass1234');
    expect(result.success).toBe(false);
  });
});

// ─── Auth Middleware Tests ────────────────────────────────────
describe('Auth Middleware', () => {
  let loadUser, requireAuth;

  beforeEach(() => {
    jest.resetModules();

    jest.doMock('../../lib/users', () => ({
      getById: jest.fn(async (id) => null),
      sanitize: jest.fn((user) => {
        if (!user) return null;
        const { passwordHash, ...safe } = user;
        return safe;
      })
    }));

    ({ loadUser, requireAuth } = require('../../middleware/auth'));
  });

  test('loadUser sets null when no session', async () => {
    const req = { session: {} };
    const res = { locals: {} };
    const next = jest.fn();

    await loadUser(req, res, next);
    expect(res.locals.user).toBeNull();
    expect(res.locals.isAuthenticated).toBe(false);
    expect(next).toHaveBeenCalled();
  });

  test('requireAuth redirects to /login when no userId', async () => {
    const req = { session: {} };
    const res = { redirect: jest.fn() };
    const next = jest.fn();

    await requireAuth(req, res, next);
    expect(res.redirect).toHaveBeenCalledWith('/login');
    expect(next).not.toHaveBeenCalled();
  });
});
