# Ёлка Малинка 2026 🎄

Telegram Mini App для новогодней ёлки с токенами MALINKA. Пользователи могут зажигать огоньки, вешать шарики, ставить свечи и дарить гифки, переводя токены MALINKA на аккаунт `malinkatrees` в блокчейне EOS.

## Структура проекта

- `frontend/` - Telegram Mini App (React + TypeScript + Vite + Tailwind)
- `backend/` - Node.js сервер + парсер транзакций EOS + Express API

## Технологии

### Frontend
- React 18 + TypeScript
- Vite
- Tailwind CSS
- Telegram Web App SDK
- Lucide React (иконки)

### Backend
- Node.js + TypeScript
- Express.js
- Supabase (PostgreSQL + Realtime)
- Axios (EOS Hyperion API)
- EOS транзакции парсинг

## Быстрый старт

### 1. Установка зависимостей

```bash
# Установка всех зависимостей
npm run install:all

# Или отдельно:
cd frontend && npm install
cd ../backend && npm install
```

### 2. Настройка Supabase

1. Создайте проект на [supabase.com](https://supabase.com)
2. Перейдите в SQL Editor
3. Выполните SQL из `backend/supabase-schema.sql`
4. Скопируйте URL и Anon Key из Settings → API

### 3. Настройка Backend

```bash
cd backend
cp env.example .env
```

Отредактируйте `.env`:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
PORT=3000
NODE_ENV=development
```

### 4. Запуск

**Вариант 1: Из корня проекта**
```bash
npm run dev              # Frontend (localhost:5173)
npm run dev:backend      # Backend (localhost:3000)
```

**Вариант 2: Отдельно**
```bash
# Terminal 1 - Frontend
cd frontend
npm run dev

# Terminal 2 - Backend  
cd backend
npm run dev
```

## Как это работает

### Парсер транзакций

Backend автоматически:
- Подключается к EOS Hyperion API
- Опрашивает транзакции каждые 10 секунд
- Ищет переводы токена MALINKA на аккаунт `malinkatrees`
- Парсит memo и создаёт украшения:
  - `light` → Огонёк
  - `ball Имя` → Шарик с именем
  - `candle Текст` → Свеча с пожеланием (до 200 символов)
  - `gift https://url.gif` → Подарок (гифка)
- Сохраняет в Supabase
- Отправляет realtime обновления

### Формат транзакций

Переведите 1 MALINKA на `malinkatrees` с одним из memo:
- `light` - зажечь огонёк
- `ball Ваше Имя` - повесить шарик
- `candle С Новым Годом!` - поставить свечу
- `gift https://example.com/gift.gif` - подарить гифку

### API Endpoints

- `GET /api/decorations` - все украшения (последние 30 дней)
- `GET /api/donors?limit=10` - топ дарителей

## Деплой

### Railway (рекомендуется)

1. Подключите репозиторий к Railway
2. Добавьте переменные окружения из `.env`
3. Railway автоматически определит `railway.json` и задеплоит

### Docker

```bash
cd backend
docker build -t malinkatrees .
docker run -p 3000:3000 --env-file .env malinkatrees
```

### Frontend сборка

```bash
cd frontend
npm run build
# Файлы будут в backend/public/
```

## Структура базы данных

Таблица `decorations`:
- `id` - уникальный ID
- `type` - тип (light, ball, candle, gift)
- `from_account` - аккаунт отправителя
- `username` - имя для шарика (опционально)
- `text` - текст для свечи (опционально)
- `image_url` - URL для подарка (опционально)
- `amount` - сумма перевода
- `tx_id` - ID транзакции EOS (уникальный)
- `created_at` - время создания

## Разработка

### Frontend
- Hot reload на `localhost:5173`
- Сборка в `backend/public/`

### Backend
- Hot reload через `tsx watch`
- Парсер запускается автоматически
- Логи в консоли

## Лицензия

MIT
