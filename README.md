# Artifact Swap — Станция обмена космическими артефактами

Веб-платформа для анонимного обмена цифровыми артефактами.

## Стек технологий

- **Сервер:** Express.js + Handlebars
- **База данных:** MongoDB + Mongoose (ODM)
- **Авторизация:** bcrypt + express-session (хранение в MongoDB через connect-mongo)
- **Файлы:** Файловая система (артефакты), MongoDB (метаданные)
- **Тесты:** Jest

---

## Запуск

### Вариант 1: Docker (рекомендуется)

Самый простой способ — всё поднимается одной командой:

```bash
docker compose up -d --build
```

Открыть: http://localhost:3000

Чтобы остановить:
```bash
docker compose down
```

---

### Вариант 2: Локально на ПК

#### 1. Установить MongoDB

**Windows:**
1. Скачать MongoDB Community Server: https://www.mongodb.com/try/download/community
2. При установке выбрать "Complete", оставить галочку "Install MongoDB as a Service"
3. MongoDB запустится автоматически на `localhost:27017`

**Проверить что MongoDB работает:**
```bash
mongosh
# Должна открыться консоль MongoDB
# Введите exit для выхода
```

#### 2. Установить зависимости

```bash
npm install
```

#### 3. Запустить сервер

```bash
node app.js
```

Вывод:
```
◈ MongoDB подключена: mongodb://localhost:27017/artifact-swap
◈ Хранилище: 0 артефактов от 0 источников
⚡ ARTIFACT SWAP — http://localhost:3000
```

#### 4. Открыть в браузере

http://localhost:3000

---

## Переменные окружения

| Переменная | По умолчанию | Описание |
|---|---|---|
| `PORT` | `3000` | Порт сервера |
| `MONGO_URI` | `mongodb://localhost:27017/artifact-swap` | Строка подключения к MongoDB |
| `COOKIE_SECRET` | `c0sm1c-v01d-s3cr3t-7g` | Секрет для подписи cookie |

---

## Тестирование

```bash
npx jest --verbose
```

## Структура проекта

```
├── app.js                     # Точка входа, подключение к MongoDB
├── lib/
│   ├── db.js                  # Модуль подключения к MongoDB
│   ├── vault.js               # Хранилище артефактов (Mongoose)
│   └── users.js               # Управление пользователями (Mongoose)
├── models/
│   ├── User.js                # Mongoose-схема пользователя
│   └── Artifact.js            # Mongoose-схема артефакта
├── middleware/
│   ├── auth.js                # Авторизация
│   └── flash.js               # Flash-уведомления
├── handlers/
│   └── main.js                # Обработчики маршрутов
├── views/                     # Handlebars-шаблоны
├── public/                    # Статика (CSS, JS, изображения, артефакты)
├── Dockerfile
└── docker-compose.yml
```
