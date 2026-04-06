const express = require('express');
const { engine } = require('express-handlebars');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const path = require('path');

const flashMiddleware = require('./middleware/flash');
const { loadUser, requireAuth } = require('./middleware/auth');
const handlers = require('./handlers/main');
const vault = require('./lib/vault');

const app = express();
const PORT = process.env.PORT || 3000;
const COOKIE_SECRET = process.env.COOKIE_SECRET || 'c0sm1c-v01d-s3cr3t-7g';

// handlebars
app.engine('hbs', engine({
  extname: '.hbs',
  defaultLayout: 'main',
  layoutsDir: path.join(__dirname, 'views', 'layouts'),
  partialsDir: path.join(__dirname, 'views', 'partials'),
  helpers: {
    eq: (a, b) => a === b,
    isImage: (mimeType) => mimeType && mimeType.startsWith('image/'),
    formatSize: (bytes) => {
      if (!bytes) return '0 Б';
      const units = ['Б', 'КБ', 'МБ', 'ГБ'];
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
    },
    gt: (a, b) => a > b
  }
}));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser(COOKIE_SECRET));
app.use(session({
  secret: COOKIE_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    signed: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 дней
    httpOnly: true
  }
}));
app.use(flashMiddleware);
app.use(loadUser);

// public
app.get('/login', handlers.showLogin);
app.post('/login', handlers.doLogin);
app.get('/register', handlers.showRegister);
app.post('/register', handlers.doRegister);
app.get('/logout', handlers.logout);

// protected
app.get('/', requireAuth, handlers.home);
app.get('/inventory', requireAuth, handlers.inventoryPage);
app.post('/api/trade', requireAuth, handlers.trade);
app.get('/api/inventory', requireAuth, handlers.inventoryApi);
app.get('/api/download/:id', requireAuth, handlers.download);
app.get('/api/preview/:id', requireAuth, handlers.preview);

// 404
app.use((req, res) => {
  res.status(404).redirect('/');
});

// 500
app.use((err, req, res, next) => {
  console.error('Ошибка на станции:', err);
  res.status(500).json({
    success: false,
    message: '⚠ Критическая ошибка на станции. Технический отсек уведомлён.'
  });
});

vault.loadSeeds();
console.log(`◈ Хранилище загружено: ${vault.stats().total} артефактов от ${vault.stats().uploaders} источников`);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`http://localhost:${PORT}`);
  });
}

module.exports = app;
