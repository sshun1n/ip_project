# Artifact Swap — Станция обмена космическими артефактами

Веб-платформа для анонимного обмена цифровыми артефактами в сеттинге «космического панка».

## Быстрый старт

### Локально
```bash
npm install
node app.js
# Открыть http://localhost:3000
```

### Docker
```bash
docker compose up -d
# Открыть http://localhost:3000
```

Для смены секрета куки на продакшене:
```bash
COOKIE_SECRET=ваш-секрет docker compose up -d
```

## Стек технологий

- **Сервер:** Express.js + Handlebars
- **Авторизация:** bcrypt + express-session
- **Хранение:** JSON-файл (пользователи), файловая система (артефакты)
- **Тесты:** Jest

## Структура проекта

```
├── app.js                  # Точка входа
├── lib/
│   ├── vault.js            # Модуль хранилища артефактов
│   └── users.js            # Модуль управления пользователями
├── middleware/
│   ├── auth.js             # Авторизация
│   └── flash.js            # Flash-уведомления
├── handlers/
│   └── main.js             # Обработчики маршрутов
├── views/                  # Handlebars-шаблоны
├── public/                 # Статика (CSS, JS, изображения)
├── data/                   # Данные пользователей (создаётся автоматически)
├── Dockerfile
└── docker-compose.yml
```

## Тестирование

```bash
npx jest --verbose
```
