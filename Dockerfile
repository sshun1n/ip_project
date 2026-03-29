FROM node:18-alpine

WORKDIR /app

# Зависимости (кешируем слой)
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Исходный код
COPY . .

# Создаём директории для данных
RUN mkdir -p data public/artifacts

# Порт приложения
EXPOSE 3000

# Переменные окружения по умолчанию
ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "app.js"]
