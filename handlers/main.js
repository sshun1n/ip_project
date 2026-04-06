const multiparty = require('multiparty');
const path = require('path');
const fs = require('fs');
const vault = require('../lib/vault');
const users = require('../lib/users');

function showLogin(req, res) {
  if (req.session.userId) return res.redirect('/');
  res.render('login');
}

function showRegister(req, res) {
  if (req.session.userId) return res.redirect('/');
  res.render('register');
}

async function doLogin(req, res) {
  const { username, password } = req.body;
  const result = await users.authenticate(username, password);

  if (!result.success) {
    req.session.flash = req.session.flash || [];
    req.session.flash.push({ type: 'warning', message: result.error, id: Date.now() });
    return res.redirect('/login');
  }

  req.session.userId = result.user.id;

  req.session.flash = req.session.flash || [];
  req.session.flash.push({
    type: 'signal',
    message: `Идентификация подтверждена. Добро пожаловать, ${result.user.username}.`,
    id: Date.now()
  });

  res.redirect('/');
}

async function doRegister(req, res) {
  const { username, password, passwordConfirm } = req.body;

  if (password !== passwordConfirm) {
    req.session.flash = req.session.flash || [];
    req.session.flash.push({ type: 'warning', message: 'Коды доступа не совпадают.', id: Date.now() });
    return res.redirect('/register');
  }

  const result = await users.register(username, password);

  if (!result.success) {
    req.session.flash = req.session.flash || [];
    req.session.flash.push({ type: 'warning', message: result.error, id: Date.now() });
    return res.redirect('/register');
  }

  req.session.flash = req.session.flash || [];
  req.session.flash.push({
    type: 'signal',
    message: 'Регистрация завершена. Войдите, используя свои данные.',
    id: Date.now()
  });

  res.redirect('/login');
}

function logout(req, res) {
  req.session.destroy(() => {
    res.redirect('/login');
  });
}

async function home(req, res) {
  const vaultStats = await vault.stats();
  res.render('home', { vaultStats });
}

async function inventoryPage(req, res) {
  const userId = req.session.userId;
  const inventory = await users.getInventory(userId);

  res.render('inventory', {
    inventory,
    hasInventory: inventory.length > 0,
    inventoryCount: inventory.length
  });
}

function trade(req, res) {
  const form = new multiparty.Form({
    maxFilesSize: vault.MAX_FILE_SIZE,
    uploadDir: require('os').tmpdir()
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: 'Ошибка при разгрузке груза. Повторите попытку, странник.'
      });
    }

    const uploaded = files && files.artifact && files.artifact[0];
    if (!uploaded || !uploaded.path || uploaded.size === 0) {
      return res.status(400).json({
        success: false,
        message: 'Грузовой отсек пуст. Загрузите артефакт для обмена.'
      });
    }

    try {
      const userId = req.session.userId;

      const deposited = await vault.deposit(
        uploaded.path,
        uploaded.originalFilename,
        userId,
        uploaded.headers ? uploaded.headers['content-type'] : null,
        uploaded.size
      );

      if (deposited.error) {
        return res.status(400).json({ success: false, message: deposited.error });
      }

      await users.addUploadedId(userId, deposited.id);

      const userInventory = await users.getInventory(userId);
      const receivedIds = userInventory.map(a => a.id);
      const received = await vault.withdraw([userId], receivedIds);

      if (!received) {
        req.session.flash = req.session.flash || [];
        req.session.flash.push({
          type: 'static',
          message: 'Хранилище пусто. Ваш артефакт — первый сигнал в пустоте. Вернитесь позже.',
          id: Date.now()
        });

        return res.json({
          success: true,
          received: null,
          message: 'Артефакт принят. Хранилище пусто — вы первый странник. Вернитесь позже.'
        });
      }

      await users.addToInventory(userId, received);

      req.session.flash = req.session.flash || [];
      req.session.flash.push({
        type: 'signal',
        message: 'Сигнал получен. Груз доставлен в ваш отсек.',
        id: Date.now()
      });

      return res.json({
        success: true,
        received: {
          id: received.id,
          name: received.originalName,
          url: received.url,
          size: received.size,
          mimeType: received.mimeType
        },
        message: 'Обмен завершён. Новый артефакт в вашем инвентаре.'
      });
    } catch (error) {
      console.error('Ошибка обмена:', error);
      return res.status(500).json({
        success: false,
        message: 'Внутренняя ошибка станции. Повторите попытку.'
      });
    }
  });
}

async function inventoryApi(req, res) {
  const userId = req.session.userId;
  const inventory = await users.getInventory(userId);
  res.json({ inventory, count: inventory.length });
}

async function download(req, res) {
  const artifact = await vault.getById(req.params.id);

  if (!artifact) {
    return res.status(404).json({ success: false, message: 'Артефакт не найден в хранилище.' });
  }

  const filePath = path.join(vault.ARTIFACTS_DIR, artifact.storedName);
  const fileName = artifact.originalName || artifact.storedName;

  // кодируем имя для кириллицы (rfc 5987)
  const encodedName = encodeURIComponent(fileName).replace(/['()]/g, escape).replace(/\*/g, '%2A');
  res.set({
    'Content-Disposition': `attachment; filename="${fileName}"; filename*=UTF-8''${encodedName}`,
    'Content-Type': artifact.mimeType || 'application/octet-stream',
    'Cache-Control': 'no-cache'
  });

  const stream = fs.createReadStream(filePath);
  stream.on('error', (err) => {
    console.error('Ошибка скачивания:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Ошибка при выгрузке.' });
    }
  });
  stream.pipe(res);
}

async function preview(req, res) {
  const artifact = await vault.getById(req.params.id);

  if (!artifact) {
    return res.status(404).json({ success: false, message: 'Артефакт не найден.' });
  }

  // превью только для текстовых
  const isText = artifact.mimeType && (
    artifact.mimeType.startsWith('text/') ||
    artifact.mimeType === 'application/json'
  );

  if (!isText) {
    return res.status(400).json({ success: false, message: 'Превью доступно только для текстовых файлов.' });
  }

  const filePath = path.join(vault.ARTIFACTS_DIR, artifact.storedName);

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const truncated = content.length > 5000;
    res.json({
      success: true,
      name: artifact.originalName,
      content: truncated ? content.slice(0, 5000) : content,
      truncated,
      totalLength: content.length
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Ошибка чтения файла.' });
  }
}

module.exports = {
  showLogin,
  showRegister,
  doLogin,
  doRegister,
  logout,
  home,
  inventoryPage,
  trade,
  inventoryApi,
  download,
  preview
};
