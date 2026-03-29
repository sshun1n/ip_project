/**
 * Миддлвар для flash-уведомлений через сессию
 * Сохраняет сообщения между запросами и передаёт в шаблоны через res.locals
 */
module.exports = function flash(req, res, next) {
  // Переносим накопленные сообщения в шаблон и очищаем
  if (req.session.flash && req.session.flash.length > 0) {
    res.locals.flash = req.session.flash;
    req.session.flash = [];
  } else {
    res.locals.flash = [];
    if (!req.session.flash) req.session.flash = [];
  }

  // Метод для добавления нового flash-сообщения
  res.flash = function (type, message) {
    req.session.flash.push({ type, message, id: Date.now() });
  };

  next();
};
