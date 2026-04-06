const users = require('../lib/users');

// загрузить пользователя из сессии
function loadUser(req, res, next) {
  res.locals.user = null;
  res.locals.isAuthenticated = false;

  if (req.session && req.session.userId) {
    const user = users.getById(req.session.userId);
    if (user) {
      res.locals.user = users.sanitize(user);
      res.locals.isAuthenticated = true;
    }
  }

  next();
}

// проверка авторизации
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    req.session.flash = req.session.flash || [];
    req.session.flash.push({
      type: 'warning',
      message: 'Идентификация обязательна. Войдите на станцию.',
      id: Date.now()
    });
    return res.redirect('/login');
  }

  const user = users.getById(req.session.userId);
  if (!user) {
    req.session.userId = null;
    return res.redirect('/login');
  }

  next();
}

module.exports = { loadUser, requireAuth };
