-- Создание таблицы decorations для хранения украшений ёлки

CREATE TABLE IF NOT EXISTS decorations (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('light', 'ball', 'candle', 'star')),
  from_account TEXT NOT NULL,
  username TEXT,
  text TEXT,
  amount TEXT NOT NULL,
  tx_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_decorations_tx_id ON decorations(tx_id);
CREATE INDEX IF NOT EXISTS idx_decorations_created_at ON decorations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_decorations_from_account ON decorations(from_account);
CREATE INDEX IF NOT EXISTS idx_decorations_type ON decorations(type);

-- Включить Realtime для таблицы
ALTER PUBLICATION supabase_realtime ADD TABLE decorations;

-- RLS (Row Level Security) - разрешаем всем читать
ALTER TABLE decorations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON decorations
  FOR SELECT USING (true);

-- Разрешаем вставку только через сервисную роль (будет использоваться через backend)
-- Для анонимных пользователей можно создать функцию или использовать сервисную роль
CREATE POLICY "Allow service role insert" ON decorations
  FOR INSERT WITH CHECK (true);


