FROM node:20-alpine

WORKDIR /app

# Копируем package files
COPY backend/package*.json ./
RUN npm ci --only=production

# Копируем исходники и собираем
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

# Копируем frontend build если есть
COPY backend/public ./public

# Открываем порт
EXPOSE 3000

# Запускаем приложение
CMD ["npm", "start"]

