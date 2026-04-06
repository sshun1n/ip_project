FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --only=production

COPY . .

RUN mkdir -p data public/artifacts

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "app.js"]
