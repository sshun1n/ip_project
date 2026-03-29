const path = require('path');
const fs = require('fs');
const os = require('os');

// ─── Vault Module Tests ──────────────────────────────────────
describe('Vault Module', () => {
  let vault;

  beforeEach(() => {
    jest.resetModules();
    const vaultPath = require.resolve('../../lib/vault');
    delete require.cache[vaultPath];
    vault = require('../../lib/vault');
    vault._registry.clear();
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

  test('deposit stores artifact and returns metadata', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-test-'));
    const tempFile = path.join(tempDir, 'test.txt');
    fs.writeFileSync(tempFile, 'Hello from deep space!');

    const result = vault.deposit(tempFile, 'test.txt', 'user-123', 'text/plain', 22);
    expect(result.error).toBeUndefined();
    expect(result.id).toBeDefined();
    expect(result.originalName).toBe('test.txt');
    expect(result.uploaderId).toBe('user-123');
    expect(result.url).toMatch(/^\/artifacts\//);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('deposit rejects files over 10MB', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-test-'));
    const tempFile = path.join(tempDir, 'big.txt');
    fs.writeFileSync(tempFile, 'x');

    const result = vault.deposit(tempFile, 'big.txt', 'user-123', 'text/plain', 11 * 1024 * 1024);
    expect(result.error).toBeDefined();

    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('deposit rejects video files', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-test-'));
    const tempFile = path.join(tempDir, 'vid.mp4');
    fs.writeFileSync(tempFile, 'fake');

    const result = vault.deposit(tempFile, 'vid.mp4', 'user-123', 'video/mp4', 100);
    expect(result.error).toContain('Видеосигналы');

    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('withdraw returns null when empty', () => {
    expect(vault.withdraw(['user-123'], [])).toBeNull();
  });

  test('withdraw excludes artifacts by uploader ID', () => {
    vault._registry.set('a1', { id: 'a1', originalName: 'f1.txt', uploaderId: 'user-A', url: '/a/1', size: 10 });
    vault._registry.set('a2', { id: 'a2', originalName: 'f2.txt', uploaderId: 'user-B', url: '/a/2', size: 20 });

    const result = vault.withdraw(['user-A'], []);
    expect(result).not.toBeNull();
    expect(result.id).toBe('a2');
  });

  test('withdraw returns null when only own files exist', () => {
    vault._registry.set('a1', { id: 'a1', uploaderId: 'user-A', url: '/a/1', size: 10 });
    expect(vault.withdraw(['user-A'], [])).toBeNull();
  });

  test('withdraw excludes already received IDs', () => {
    vault._registry.set('a1', { id: 'a1', uploaderId: 'user-B', url: '/a/1', size: 10 });
    vault._registry.set('a2', { id: 'a2', uploaderId: 'user-B', url: '/a/2', size: 20 });

    const result = vault.withdraw(['user-A'], ['a1']);
    expect(result.id).toBe('a2');
  });

  test('stats returns correct counts', () => {
    vault._registry.set('a1', { id: 'a1', uploaderId: 'user-A' });
    vault._registry.set('a2', { id: 'a2', uploaderId: 'user-B' });
    vault._registry.set('a3', { id: 'a3', uploaderId: 'user-A' });

    const s = vault.stats();
    expect(s.total).toBe(3);
    expect(s.uploaders).toBe(2);
  });

  test('getById returns artifact or null', () => {
    vault._registry.set('a1', { id: 'a1', originalName: 'test.txt' });
    expect(vault.getById('a1').originalName).toBe('test.txt');
    expect(vault.getById('nope')).toBeNull();
  });
});

// ─── Flash Middleware Tests ──────────────────────────────────
describe('Flash Middleware', () => {
  let flashMiddleware;

  beforeEach(() => {
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

  beforeEach(() => {
    jest.resetModules();
    users = require('../../lib/users');
    users._users.clear();
  });

  test('register creates user with hashed password', async () => {
    const result = await users.register('TestPilot', 'pass1234');
    expect(result.success).toBe(true);
    expect(result.user.username).toBe('TestPilot');
    expect(result.user.passwordHash).toBeUndefined(); // sanitized
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
    const result = await users.register('testpilot', 'pass5678'); // case insensitive
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

  test('addToInventory and getInventory', async () => {
    const reg = await users.register('Pilot', 'pass1234');
    const userId = reg.user.id;

    users.addToInventory(userId, {
      id: 'art-1', originalName: 'file.txt', url: '/a/1', size: 100, mimeType: 'text/plain'
    });

    const inv = users.getInventory(userId);
    expect(inv).toHaveLength(1);
    expect(inv[0].name).toBe('file.txt');
  });
});

// ─── Auth Middleware Tests ────────────────────────────────────
describe('Auth Middleware', () => {
  let loadUser, requireAuth, users;

  beforeEach(() => {
    jest.resetModules();
    users = require('../../lib/users');
    users._users.clear();
    ({ loadUser, requireAuth } = require('../../middleware/auth'));
  });

  test('loadUser sets null when no session', () => {
    const req = { session: {} };
    const res = { locals: {} };
    const next = jest.fn();

    loadUser(req, res, next);
    expect(res.locals.user).toBeNull();
    expect(res.locals.isAuthenticated).toBe(false);
    expect(next).toHaveBeenCalled();
  });

  test('requireAuth redirects to /login when no userId', () => {
    const req = { session: {} };
    const res = { redirect: jest.fn() };
    const next = jest.fn();

    requireAuth(req, res, next);
    expect(res.redirect).toHaveBeenCalledWith('/login');
    expect(next).not.toHaveBeenCalled();
  });
});
