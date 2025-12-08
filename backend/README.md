# Backend - Ёлка Малинка

Node.js сервер с парсером транзакций EOS и API для фронтенда.

## Установка

```bash
npm install
```

## Настройка

1. Скопируйте `env.example` в `.env`
2. Заполните переменные окружения:
   - `SUPABASE_URL` - URL вашего Supabase проекта
   - `SUPABASE_ANON_KEY` - Anon Key из Supabase

## Создание таблицы в Supabase

Выполните SQL из `supabase-schema.sql` в SQL Editor Supabase.

## Запуск

```bash
npm run dev    # Разработка с hot reload
npm run build  # Сборка
npm start      # Запуск production
```

## API Endpoints

- `GET /health` - Health check
- `GET /api/decorations` - Получить все украшения
- `GET /api/donors?limit=10` - Получить топ дарителей

## Парсер транзакций

Парсер автоматически запускается при старте сервера и:
- Опрашивает EOS Hyperion API каждые 10 секунд
- Парсит транзакции токена MALINKA на аккаунт malinkatrees
- Обрабатывает memo и сохраняет украшения в Supabase
- Отправляет broadcast через Supabase Realtime

