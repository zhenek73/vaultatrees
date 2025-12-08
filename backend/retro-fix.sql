-- Ретро-фикс: Добавление существующих переводов в базу данных
-- Выполни этот SQL в Supabase SQL Editor один раз

INSERT INTO decorations (type, from_account, username, amount, tx_id, created_at)
VALUES 
  ('light', 'cryptozhenek', 'cryptozhenek', '1.0000 MLNK', '9029de573e52891164c4ba8938fed4d96f7ad1c242b0d2d05d9af844b440dfac', NOW()),
  ('ball', 'cryptozhenek', 'cryptozhenek', '10.0000 MLNK', 'f965ede92e57f57b1a5b28096bf78256c32bd6776142d70735daf050c219d2a4', NOW())
ON CONFLICT (tx_id) DO NOTHING;
