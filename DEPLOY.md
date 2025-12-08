# Инструкция по деплою

## Подготовка

### 1. Supabase

1. Зайдите на [supabase.com](https://supabase.com)
2. Создайте новый проект
3. Перейдите в SQL Editor
4. Выполните SQL из `backend/supabase-schema.sql`
5. В Settings → API скопируйте:
   - Project URL → `SUPABASE_URL`
   - anon/public key → `SUPABASE_ANON_KEY`

### 2. Railway (автоматический деплой)

1. Зайдите на [railway.app](https://railway.app)
2. New Project → Deploy from GitHub repo
3. Выберите репозиторий `zhenek73/malinkatrees`
4. Добавьте переменные окружения:
   ```
   SUPABASE_URL=your_url
   SUPABASE_ANON_KEY=your_key
   PORT=3000
   NODE_ENV=production
   EOS_CONTRACT=malinka.token
   EOS_ACCOUNT=malinkatrees
   HYPERION_API_URL=https://eos.hyperion.eosrio.io/v2
   ```
5. Railway автоматически определит `railway.json` и задеплоит

### 3. Frontend деплой

После деплоя backend:
1. Соберите frontend: `cd frontend && npm run build`
2. Файлы будут в `backend/public/`
3. Backend автоматически отдаёт статику из `/`

### 4. Telegram Bot

1. Создайте бота через [@BotFather](https://t.me/BotFather)
2. Используйте команду `/newapp` или `/newbot`
3. Укажите URL вашего Railway деплоя
4. Готово!

## Проверка работы

1. Откройте ваш Telegram Mini App
2. Должна загрузиться ёлка
3. Сделайте тестовый перевод 1 MALINKA на `malinkatrees` с memo `light`
4. Через 10-20 секунд должен зажечься огонёк

