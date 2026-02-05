-- List all users and check if they have a password hash set.
-- Run on VPS: psql $DATABASE_URL -f scripts/check-users.sql

SELECT
  id,
  username,
  email,
  confirmed,
  blocked,
  CASE
    WHEN password IS NULL OR password = '' THEN 'NINCS'
    ELSE 'VAN (' || length(password) || ' karakter)'
  END AS jelszo_allapot,
  created_at,
  updated_at
FROM up_users
ORDER BY id;
