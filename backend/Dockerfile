FROM node:18-alpine

WORKDIR /app

# Копируем корневой package.json (если есть)
COPY package.json .

# Устанавливаем зависимости
RUN npm install

# Копируем frontend и собираем его
COPY frontend/package.json frontend/
RUN cd frontend && npm install && npm run build

# Копируем backend
COPY backend/ backend/
RUN cd backend && npm install

# Копируем собранный frontend в backend/public
RUN cp -r frontend/dist/* backend/public/

# Запускаем сервер
WORKDIR /app/backend
CMD ["npm", "start"]